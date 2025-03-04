// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  try to take over the world!
// @author       You
// @match        https://wingify.atlassian.net/jira*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=atlassian.net
// @grant        none
// @updateURL    https://github.com/sidrohravwo/Jira-Stats/raw/refs/heads/main/index.user.js
// @downloadURL  https://github.com/sidrohravwo/Jira-Stats/raw/refs/heads/main/index.user.js
// ==/UserScript==

(function() {
    'use strict';
    console.log("New Version 1.3");
    async function getJiraTaskStats(projectKey, versionName, month, year) {
    try {
        const versionsResponse = await fetch(`/rest/api/3/project/${projectKey}/versions`);
        const versions = await versionsResponse.json();

        const version = versions.find(v => v.name === versionName);
        if (!version) {
            console.error("Version not found.");
            return;
        }

        const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`;
        let endDate = new Date(year, month, 0).getDate().toString().padStart(2, '0');
        const startOfNextMonth = `${year}-${(month).toString().padStart(2, '0')}-${endDate}`;
        const maxResults = 100;

        let totalReleased = 0, totalCreated = 0, totalUniqueTasks = 0;
        let releasedByAssignee = {}, releasedByReporter = {};
        let createdByReporter = {}, uniqueTasksByAssignee = {}, uniqueTasksByReporter = {};

        // Fetch Released Tasks (With Fix Version)
        let startAt = 0, releasedIssues = [], searchResults;
        do {
            const jqlQuery = `fixVersion=${version.id} AND project=${projectKey}`;
            const searchResponse = await fetch(`/rest/api/3/search?jql=${encodeURIComponent(jqlQuery)}&fields=status,assignee,reporter,created&startAt=${startAt}&maxResults=${maxResults}`);
            searchResults = await searchResponse.json();

            releasedIssues = releasedIssues.concat(searchResults.issues || []);
            startAt += maxResults;
        } while (searchResults.total > releasedIssues.length);

        releasedIssues.forEach(issue => {
            const status = issue.fields.status.name.toLowerCase();
            if (status === "released" || status === "done" || status === "completed") {
                totalReleased++;

                const assignee = issue.fields.assignee ? issue.fields.assignee.displayName : "Unassigned";
                releasedByAssignee[assignee] = (releasedByAssignee[assignee] || 0) + 1;

                const reporter = issue.fields.reporter ? issue.fields.reporter.displayName : "Unknown Reporter";
                releasedByReporter[reporter] = (releasedByReporter[reporter] || 0) + 1;
            }
        });

        // Fetch Created Tasks (Excluding Fix Version)
        startAt = 0;
        let createdIssues = [];
        do {
            const jqlQuery = `project=${projectKey} AND created >= ${startOfMonth} AND created < ${startOfNextMonth}`;
            const searchResponse = await fetch(`/rest/api/3/search?jql=${encodeURIComponent(jqlQuery)}&fields=reporter,fixVersions,assignee&startAt=${startAt}&maxResults=${maxResults}`);
            searchResults = await searchResponse.json();

            createdIssues = createdIssues.concat(searchResults.issues || []);
            startAt += maxResults;
        } while (searchResults.total > createdIssues.length);

        totalCreated = createdIssues.length;

        createdIssues.forEach(issue => {
            const reporter = issue.fields.reporter ? issue.fields.reporter.displayName : "Unknown Reporter";
            createdByReporter[reporter] = (createdByReporter[reporter] || 0) + 1;
        });

        // Fetch Unique Tasks (Created in Month AND Has Fix Version)
        startAt = 0;
        let uniqueIssues = [];
        do {
            const jqlQuery = `fixVersion=${version.id} AND project=${projectKey} AND created >= ${startOfMonth} AND created < ${startOfNextMonth}`;
            const searchResponse = await fetch(`/rest/api/3/search?jql=${encodeURIComponent(jqlQuery)}&fields=assignee,reporter&startAt=${startAt}&maxResults=${maxResults}`);
            searchResults = await searchResponse.json();

            uniqueIssues = uniqueIssues.concat(searchResults.issues || []);
            startAt += maxResults;
        } while (searchResults.total > uniqueIssues.length);

        totalUniqueTasks = uniqueIssues.length;

        uniqueIssues.forEach(issue => {
            const assignee = issue.fields.assignee ? issue.fields.assignee.displayName : "Unassigned";
            uniqueTasksByAssignee[assignee] = (uniqueTasksByAssignee[assignee] || 0) + 1;

            const reporter = issue.fields.reporter ? issue.fields.reporter.displayName : "Unknown Reporter";
            uniqueTasksByReporter[reporter] = (uniqueTasksByReporter[reporter] || 0) + 1;
        });

        return {
            totalReleased,
            releasedByAssignee,
            releasedByReporter,
            totalCreated,
            createdByReporter,
            totalUniqueTasks,
            uniqueTasksByAssignee,
            uniqueTasksByReporter
        };

    } catch (error) {
        console.error("Error fetching Jira data:", error);
        return;
    }
}


(function () {
    if (document.getElementById("jira-stats-button")) return;

    // Create "Stats Report" Button
    const statsButton = document.createElement("button");
    statsButton.id = "jira-stats-button";
    statsButton.innerText = "Stats Report";
    statsButton.style.cssText = `
        position: fixed;
        bottom: 0;
        right: 0;
        margin: 5%;
        padding: 12px 20px;
        background: #0052cc;
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 9999;
    `;
    document.body.appendChild(statsButton);

    // Create Modal Overlay
    const modalOverlay = document.createElement("div");
    modalOverlay.id = "jira-modal-overlay";
    modalOverlay.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9998;
    `;

    // Create Modal Content
    const modal = document.createElement("div");
    modal.id = "jira-modal";
    modal.style.cssText = `
        display: none;
        position: fixed;
        inset: calc(100% - 90vh) 0px 0px 0%;
        transform: none;
        width: 500px;
        background: rgb(255, 255, 255);
        padding: 20px;
        border-radius: 8px;
        box-shadow: rgba(0, 0, 0, 0.15) 0px 6px 12px;
        z-index: 9999;
        font-family: Arial, sans-serif;
        margin: auto;
        max-height: 70vh;
        overflow-y: auto;
        bottom: auto;
    `;

    modal.innerHTML = `
        <h2 style="margin: 0 0 15px; font-size: 18px; text-align: center;">Jira Stats Report</h2>
        <form id="jira-stats-form" style="display: flex; flex-direction: column; gap: 10px;">
            <input type="text" id="projectKey" value="VWOSIMP" placeholder="Project Key" required style="padding: 8px; border: 1px solid #ccc; border-radius: 5px;">
            <input type="text" id="versionName" placeholder="Version Name" required style="padding: 8px; border: 1px solid #ccc; border-radius: 5px;">
            <input type="number" id="month" placeholder="Month (1-12)" required min="1" max="12" style="padding: 8px; border: 1px solid #ccc; border-radius: 5px;">
            <input type="number" id="year" placeholder="Year" required min="2000" max="2100" style="padding: 8px; border: 1px solid #ccc; border-radius: 5px;">
            <button type="submit" style="padding: 10px; background: #28a745; color: #fff; border: none; border-radius: 5px; cursor: pointer;">Fetch Stats</button>
        </form>
        <div id="jira-stats-container" style="display: none; margin-top: 15px;">
            <table id="jira-stats-table" style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f4f4f4;">
                        <th style="padding: 8px; border: 1px solid #ddd;">Metric</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Count</th>
                    </tr>
                </thead>
                <tbody id="jira-stats-content"></tbody>
            </table>
        </div>
        <button id="close-modal" style="
            display: block;
            padding: 10px;
            background: #d9534f;
            color: #fff;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            position: sticky;
            bottom: 0;
            width: 50%;
            margin: 20px auto 0;
        ">Close</button>
    `;

    document.body.appendChild(modalOverlay);
    document.body.appendChild(modal);

    // Button Click -> Show Modal
    statsButton.addEventListener("click", function () {
        modalOverlay.style.display = "block";
        modal.style.display = "block";
    });

    // Handle Form Submission
    document.getElementById("jira-stats-form").addEventListener("submit", async function (event) {
        event.preventDefault();

        const projectKey = document.getElementById("projectKey").value.trim();
        const versionName = document.getElementById("versionName").value.trim();
        const month = +document.getElementById("month").value.trim();
        const year = +document.getElementById("year").value.trim();

        if (!projectKey || !versionName || !month || !year) return;

        const statsContainer = document.getElementById("jira-stats-container");
        const statsContent = document.getElementById("jira-stats-content");

        statsContainer.style.display = "block";
        statsContent.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 8px;">Fetching data...</td></tr>`;

        const stats = await getJiraTaskStats(projectKey, versionName, month, year);
        if (!stats) {
            statsContent.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 8px; color: red;">Failed to fetch data.</td></tr>`;
            return;
        }

        statsContent.innerHTML = `
            <tr><td>Total Released Tasks</td><td>${stats.totalReleased}</td></tr>
            <tr><td>Total Created Tasks</td><td>${stats.totalCreated}</td></tr>
            <tr><td>Total Unique Tasks</td><td>${stats.totalUniqueTasks}</td></tr>
            <tr><td colspan="2" style="background: #eee; text-align: center;"><b>Released by Assignee</b></td></tr>
            ${formatStats(stats.releasedByAssignee)}
            <tr><td colspan="2" style="background: #eee; text-align: center;"><b>Released by Reporter</b></td></tr>
            ${formatStats(stats.releasedByReporter)}
            <tr><td colspan="2" style="background: #eee; text-align: center;"><b>Created by Reporter</b></td></tr>
            ${formatStats(stats.createdByReporter)}
            <tr><td colspan="2" style="background: #eee; text-align: center;"><b>Unique by Assignee</b></td></tr>
            ${formatStats(stats.uniqueTasksByAssignee)}
            <tr><td colspan="2" style="background: #eee; text-align: center;"><b>Unique by Reporter</b></td></tr>
            ${formatStats(stats.uniqueTasksByReporter)}
        `;
    });

    // Close Modal Events
    document.getElementById("close-modal").addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", closeModal);

    function closeModal() {
        modalOverlay.style.display = "none";
        modal.style.display = "none";
    }

    function formatStats(statsObj) {
        return Object.entries(statsObj)
            .map(([key, value]) => `<tr><td>${key}</td><td>${value}</td></tr>`)
            .join("");
    }
})();



// getJiraTaskStats("VWOSIMP", "January 2025", 1, 2025).then(data => {
//     console.log("Total Released Tasks:", data.totalReleased);
//     console.log("Released Tasks by Assignee:", data.releasedByAssignee);
//     console.log("Released Tasks by Reporter:", data.releasedByReporter);

//     console.log("Total Created Tasks:", data.totalCreated);
//     console.log("Total Created Tasks by Reporter:", data.createdByReporter);

//     console.log("Total Unique Tasks:", data.totalUniqueTasks);
//     console.log("Unique Tasks by Assignee:", data.uniqueTasksByAssignee);
//     console.log("Unique Tasks by Reporter:", data.uniqueTasksByReporter);
// });
})();
