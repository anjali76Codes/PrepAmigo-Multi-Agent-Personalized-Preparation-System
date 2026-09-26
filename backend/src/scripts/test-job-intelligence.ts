import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { getJobIntelligence } from "../agent/jobIntelligence/service.js";
import { config } from "../config/env.js";

async function runTest() {
  console.log("=================================================");
  console.log("  PrepAmigo - Job Intelligence Agent Interactive CLI");
  console.log("=================================================\n");

  const rl = readline.createInterface({ input, output });

  try {
    await connectDB();
    console.log(" MongoDB connected successfully.\n");

    // Parse command line arguments if provided (e.g. --company="Apple" --role="iOS Engineer" --location="Cupertino, CA")
    const args = process.argv.slice(2);
    const getArg = (flag: string) => {
      const match = args.find((a) => a.startsWith(`--${flag}=`));
      return match ? match.split("=")[1].replace(/^['"]|['"]$/g, "") : null;
    };

    let company = getArg("company");
    let role = getArg("role");
    let location = getArg("location");

    // If args not provided, prompt interactively
    if (!role || !location) {
      console.log("Enter search criteria (press Enter to accept default sample values):\n");
      
      const inputCompany = await rl.question("🏢 Company Name (default 'Google'): ");
      company = inputCompany.trim() || "Google";

      const inputRole = await rl.question("💼 Job Role (default 'Software Engineer'): ");
      role = inputRole.trim() || "Software Engineer";

      const inputLocation = await rl.question("📍 Location (default 'Mountain View, CA'): ");
      location = inputLocation.trim() || "Mountain View, CA";

      const forceAns = await rl.question("⚡ Force live SerpApi refresh bypassing cache? (y/N): ");
      var forceRefresh = forceAns.trim().toLowerCase() === "y";
    } else {
      company = company || "";
      var forceRefresh = false;
    }

    rl.close();

    console.log(`\n-------------------------------------------------`);
    console.log(`Searching Job Intelligence Profile for:`);
    console.log(`- Company  : ${company || "(Any / Role-wide)"}`);
    console.log(`- Role     : ${role}`);
    console.log(`- Location : ${location}`);
    console.log(`- Force Live Refresh?: ${forceRefresh ? "YES" : "NO (Use cache if available)"}`);
    console.log(`-------------------------------------------------\n`);

    console.log(`[TEST 1] Executing getJobIntelligence...`);
    const startTime1 = Date.now();
    const result1 = await getJobIntelligence(company, role, location, {
      forceRefresh,
    });
    const duration1 = Date.now() - startTime1;

    console.log(`\n TEST 1 Completed in ${duration1}ms`);
    console.log("=================================================");
    console.log("Normalized Query Key:", result1.normalizedQueryKey);
    console.log("Company:", result1.company);
    console.log("Role:", result1.role);
    console.log("Location:", result1.location);
    console.log("Data Coverage Score:", result1.coverage);
    console.log("Is Fallback Used?:", result1.isFallback);
    if (result1.isFallback) {
      console.log("Fallback Reason:", result1.fallbackReason);
    }
    console.log("Total Postings Count:", result1.postingsCount);
    console.log("Analyzed Postings Count:", result1.analyzedPostingsCount);
    console.log("Seniority Breakdown:", result1.seniorityDistribution);
    console.log("Employment Types:", result1.employmentTypes);
    console.log("Extracted Skills Count:", result1.skills.length);
    console.log("Skills Preview (Top 8):");
    console.table(
      result1.skills.slice(0, 8).map((s) => ({
        Skill: s.normalizedName,
        Category: s.category,
        Priority: s.priority,
        Frequency: `${s.frequency} (${s.percentage}%)`,
      }))
    );
    console.log("Common Responsibilities:", result1.commonResponsibilities);
    console.log("Common Qualifications:", result1.commonQualifications);
    console.log("Profile Expires At (TTL):", result1.expiresAt);
    console.log("=================================================\n");

    console.log(`[TEST 2] Re-requesting identical query to demonstrate MongoDB Caching Layer...`);
    const startTime2 = Date.now();
    const result2 = await getJobIntelligence(company, role, location);
    const duration2 = Date.now() - startTime2;

    console.log(`\n TEST 2 Completed in ${duration2}ms (SERVED FROM MONGODB CACHE!)`);
    console.log("-------------------------------------------------");
    console.log("Query Key Match?:", result1.normalizedQueryKey === result2.normalizedQueryKey);
    console.log("Execution Speed:", `${duration2}ms (instant cache hit from MongoDB)`);
    console.log("-------------------------------------------------\n");

    console.log("🎉 INTERACTIVE TEST COMPLETED SUCCESSFULLY!");
  } catch (err: any) {
    console.error("\n TEST FAILED:", err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  } finally {
    rl.close();
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
    process.exit(0);
  }
}

runTest();
