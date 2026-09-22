/**
 * LoanWise backend — Google Apps Script Web App
 *
 * Two responsibilities, both server-side so no secret ever ships to the
 * browser or the GitHub repo:
 *   1. ai_insight       -> calls the Anthropic Claude API and returns text
 *   2. log_submission   -> appends a row to a Google Sheet
 *
 * ---------------------------------------------------------------------
 * SETUP
 * ---------------------------------------------------------------------
 * 1. Create a new Google Sheet. Note its ID (the long string in its URL).
 * 2. Extensions > Apps Script. Paste this file in as Code.gs.
 * 3. Project Settings > Script Properties, add:
 *      CLAUDE_API_KEY  = your Anthropic API key
 *      SHEET_ID        = the Sheet ID from step 1
 * 4. Deploy > New deployment > type "Web app".
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. Copy the deployed /exec URL into js/api.js -> APPS_SCRIPT_URL.
 * ---------------------------------------------------------------------
 */

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action;

  if (action === "ai_insight") {
    return jsonResponse(handleAIInsight(body));
  }
  if (action === "log_submission") {
    return jsonResponse(handleLogSubmission(body));
  }
  return jsonResponse({ error: "Unknown action: " + action });
}

function handleAIInsight(body) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY");
  if (!apiKey) {
    return { error: "CLAUDE_API_KEY is not set in Script Properties." };
  }

  var prompt = buildPrompt(body.tool, body.inputs, body.result);

  var payload = {
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  };

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
  var data = JSON.parse(response.getContentText());

  if (data.error) {
    return { error: data.error.message || "Claude API error" };
  }

  var text = (data.content || [])
    .filter(function (block) { return block.type === "text"; })
    .map(function (block) { return block.text; })
    .join("\n");

  return { text: text || "No insight returned." };
}

function buildPrompt(tool, inputs, result) {
  var context =
    "You are a plain-language financial assistant embedded in a BFSI web tool called LoanWise. " +
    "Given the user's inputs and the calculated result below, write a short (3-5 sentence), " +
    "specific, non-generic insight. No disclaimers boilerplate, no markdown headers, " +
    "just direct, useful commentary a person can act on.\n\n" +
    "Tool: " + tool + "\n" +
    "Inputs: " + JSON.stringify(inputs) + "\n" +
    "Calculated result: " + JSON.stringify(result);
  return context;
}

function handleLogSubmission(body) {
  var sheetId = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (!sheetId) {
    return { error: "SHEET_ID is not set in Script Properties." };
  }

  var ss = SpreadsheetApp.openById(sheetId);
  var sheetName = body.tool || "submissions";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["timestamp", "inputs", "result"]);
  }

  sheet.appendRow([
    body.timestamp || new Date().toISOString(),
    JSON.stringify(body.inputs || {}),
    JSON.stringify(body.result || {}),
  ]);

  return { logged: true };
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
