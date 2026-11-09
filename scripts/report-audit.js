import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
let report = {};
try { report = JSON.parse(result.stdout || "{}"); } catch {
  console.error("Dependency audit output could not be parsed.");
  process.exit(0);
}
const vulnerabilities = report.vulnerabilities || {};
const entries = Object.entries(vulnerabilities);
console.log("DEPENDENCY_AUDIT_SUMMARY", JSON.stringify(report.metadata?.vulnerabilities || {}));
for (const [name, item] of entries) {
  const titles = (item.via || []).map(v => typeof v === "string" ? v : v.title || v.name || "Advisory");
  console.log("DEPENDENCY_AUDIT_ITEM", JSON.stringify({
    name, severity: item.severity, isDirect: item.isDirect, range: item.range,
    fixAvailable: item.fixAvailable, advisories: titles
  }));
}
if (result.error) console.log("DEPENDENCY_AUDIT_RUN_ERROR", result.error.message);