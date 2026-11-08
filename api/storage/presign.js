import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Pool } from "@neondatabase/serverless";

const APP_ORIGIN="https://app.ethandigitalacademy.org";
const BUCKET=process.env.NEON_STORAGE_BUCKET||"ethan-lms-materials";
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const required=["DATABASE_URL","NEON_AUTH_JWKS_URL","AWS_ENDPOINT_URL_S3","AWS_REGION","AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY"];
const missing=required.filter(k=>!process.env[k]);
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:5000}):null;
const jwks=process.env.NEON_AUTH_JWKS_URL?createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL)):null;
const s3=new S3Client({
 region:process.env.AWS_REGION||"eu-central-1",
 endpoint:process.env.AWS_ENDPOINT_URL_S3,
 forcePathStyle:true,
 requestChecksumCalculation:"WHEN_REQUIRED",
 credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID||"",secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY||""}
});
let corsReady;
async function ensureCors(){
 if(!corsReady){
  corsReady=s3.send(new PutBucketCorsCommand({Bucket:BUCKET,CORSConfiguration:{CORSRules:[{
   AllowedOrigins:[APP_ORIGIN],AllowedMethods:["GET","HEAD","PUT"],AllowedHeaders:["*"],ExposeHeaders:["ETag"],MaxAgeSeconds:3600
  }]}})).catch(e=>{corsReady=null;throw e;});
 }
 return corsReady;
}
function respond(res,status,body){
 res.setHeader("Cache-Control","no-store, max-age=0");
 return res.status(status).json(body);
}
async function bodyOf(req){
 if(req.body&&typeof req.body==="object"&&!Buffer.isBuffer(req.body))return req.body;
 if(Buffer.isBuffer(req.body))return JSON.parse(req.body.toString("utf8"));
 if(typeof req.body==="string"&&req.body)return JSON.parse(req.body);
 return {};
}
async function authenticate(req){
 if(!pool||!jwks)throw Object.assign(new Error("The LMS storage service is not configured."),{statusCode:503});
 const header=req.headers.authorization||req.headers.Authorization||"";
 const m=/^Bearer\s+(.+)$/i.exec(String(header));
 if(!m)throw Object.assign(new Error("Sign in to Ethan LMS first."),{statusCode:401});
 const {payload}=await jwtVerify(m[1],jwks);
 const userId=String(payload.sub||"");
 if(!UUID_RE.test(userId)||payload.role!=="authenticated")throw Object.assign(new Error("Your LMS session is invalid. Sign in again."),{statusCode:401});
 const result=await pool.query("SELECT role::text AS role FROM public.profiles WHERE id=$1",[userId]);
 return {userId,role:result.rows[0]?.role||"student"};
}
function safeKey(userId,key,courseId){
 if(typeof key!=="string"||key.length>1024||key.includes("\\")||key.split("/").some(x=>!x||x==="."||x===".."))throw Object.assign(new Error("Invalid course-material path."),{statusCode:400});
 const coursePrefix=String(courseId||"");
 if(!UUID_RE.test(coursePrefix)||!key.startsWith(coursePrefix+"/"))throw Object.assign(new Error("The requested file path is not valid for this course."),{statusCode:400});
 return key;
}
export default async function handler(req,res){
 const origin=req.headers.origin||"";
 if(origin&&origin!==APP_ORIGIN)return respond(res,403,{error:"Origin not allowed."});
 res.setHeader("Vary","Origin");
 res.setHeader("Access-Control-Allow-Origin",APP_ORIGIN);
 res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
 res.setHeader("Access-Control-Allow-Headers","Authorization, Content-Type");
 if(req.method==="OPTIONS")return res.status(204).end();
 if(req.method!=="POST")return respond(res,405,{error:"Method not allowed."});
 if(missing.length)return respond(res,503,{error:"The LMS file service is not fully configured."});
 try{
  const {userId,role}=await authenticate(req);
  const body=await bodyOf(req);
  const action=String(body.action||"");
  if(action==="upload"){
   if(!["super_admin","admin","instructor"].includes(role))return respond(res,403,{error:"Only academy staff can upload course materials."});
   const courseId=String(body.courseId||"");
   const key=safeKey(userId,body.key,courseId);
   const course=await pool.query("SELECT id FROM public.courses WHERE id=$1",[courseId]);
   if(!course.rows.length)return respond(res,404,{error:"The selected course was not found."});
   const contentType=String(body.contentType||"application/pdf").slice(0,160);
   if(!/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(contentType))return respond(res,400,{error:"Invalid file type."});
   await ensureCors();
   const url=await getSignedUrl(s3,new PutObjectCommand({Bucket:BUCKET,Key:key,ContentType:contentType}),{expiresIn:300});
   return respond(res,200,{url,headers:{"Content-Type":contentType},expiresIn:300});
  }
  if(action==="download"){
   const key=String(body.key||"");
   const record=await pool.query("SELECT cm.file_name,cm.file_path,c.published FROM public.course_materials cm JOIN public.courses c ON c.id=cm.course_id WHERE cm.file_path=$1 AND cm.is_active=true LIMIT 1",[key]);
   if(!record.rows.length)return respond(res,404,{error:"This course material is unavailable."});
   const material=record.rows[0];
   if(!material.published&&!["super_admin","admin","instructor"].includes(role))return respond(res,403,{error:"This material is not published yet."});
   await ensureCors();
   const requested=Math.max(60,Math.min(3600,Math.floor(Number(body.expiresIn)||600)));
   const filename=String(material.file_name||"course-material.pdf").replace(/[\r\n"\\]/g,"_").slice(0,180);
   const url=await getSignedUrl(s3,new GetObjectCommand({Bucket:BUCKET,Key:key,ResponseContentDisposition:'inline; filename="'+filename+'"'}),{expiresIn:requested});
   return respond(res,200,{url,expiresIn:requested});
  }
  if(action==="delete"){
   if(!["super_admin","admin","instructor"].includes(role))return respond(res,403,{error:"Only academy staff can delete course materials."});
   const key=String(body.key||"");
   const record=await pool.query("SELECT file_path FROM public.course_materials WHERE file_path=$1 LIMIT 1",[key]);
   if(!record.rows.length)return respond(res,404,{error:"Course material not found."});
   await s3.send(new DeleteObjectCommand({Bucket:BUCKET,Key:key}));
   return respond(res,200,{ok:true});
  }
  return respond(res,400,{error:"Unknown storage action."});
 }catch(error){
  const status=Number(error.statusCode)||(error.code==="ERR_JWT_EXPIRED"?401:500);
  console.error("[Ethan LMS file service]",error.code||error.name||"Error",error.message||"");
  return respond(res,status,{error:status>=500?"The course-material service could not complete the request. Please try again.":error.message||"The request was not authorised."});
 }
}
