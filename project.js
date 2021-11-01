// minimist
// axios
// jsdom
// excel4node
// pdf-lib

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");
const { SSL_OP_NO_TLSv1 } = require("constants");

// node project.js --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results --excel=Worldcup.csv --dataFolder=data
let args = minimist(process.argv);

//download using axios
//read using jsdom
//make excel using excel4node
//make pdf using pdf-lib

let responsePromise = axios.get(args.source);
responsePromise
  .then(function (response) {
    let html = response.data;
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let matches = [];
    let matchScoreDivs = document.querySelectorAll("div.match-score-block");
    for (let i = 0; i < matchScoreDivs.length; i++) {
      let match = {
        t1: "",
        t2: "",
        t1s: "",
        t2s: "",
        result: "",
        detail: "",
      };

      let namePs = matchScoreDivs[i].querySelectorAll("p.name");
      match.t1 = namePs[0].textContent;
      match.t2 = namePs[1].textContent;

      let scoreSpans = matchScoreDivs[i].querySelectorAll(
        "div.score-detail > span.score"
      );
      if (scoreSpans.length == 2) {
        match.t1s = scoreSpans[0].textContent;
        match.t2s = scoreSpans[1].textContent;
      } else if (scoreSpans.length == 1) {
        match.t1s = scoreSpans[0].textContent;
      } else {
        match.t1s = "";
        match.t2s = "";
      }

      let spanResult = matchScoreDivs[i].querySelector(
        "div.status-text > span"
      );
      match.result = spanResult.textContent;

      let matchDetail = matchScoreDivs[i].querySelector(
        "div.match-info > div.description"
      );
      match.detail = matchDetail.textContent;

      matches.push(match);
    }

    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesJSON, "utf-8");

    let teams = [];
    for (let i = 0; i < matches.length; i++) {
      populateTeams(teams, matches[i]);
    }

    for (let i = 0; i < matches.length; i++) {
      populateTeamMatches(teams, matches[i]);
    }

    createExcelFile(teams);
    createTeamFolders(teams);
  })
  .catch(function (err) {
    console.log(err);
  });

function createTeamFolders(teams) {
  if (!fs.existsSync(args.dataFolder)) {
    fs.mkdirSync(args.dataFolder);
  }

  for (let i = 0; i < teams.length; i++) {
    let teamFN = path.join(args.dataFolder, teams[i].name);
    if (!fs.existsSync(teamFN)) {
      fs.mkdirSync(teamFN);
    }

    for (let j = 0; j < teams[i].matches.length; j++) {
      let matchFileName = path.join(teamFN, teams[i].matches[j].vs + ".pdf");

      createScoreCard(teams[i].name, teams[i].matches[j], matchFileName);
    }
  }
}

function createScoreCard(teamName, match, matchFileName) {
  let t1 = teamName;
  let t2 = match.vs;
  let s1 = match.selfScore;
  let s2 = match.oppScore;
  let result = match.result;
  let detail = match.detail;

  let bytesOfPDFTemplate = fs.readFileSync("Template2.pdf");
  let pdfdocKaPromise = pdf.PDFDocument.load(bytesOfPDFTemplate);
  pdfdocKaPromise.then(function (pdfdoc) {
    let page = pdfdoc.getPage(0);

    page.drawText(t1, {
      x: 38,
      y: 340,
      size: 22,
    });
    page.drawText(s1, {
      x: 220,
      y: 340,
      size: 22,
    });
    page.drawText(t2, {
      x: 308,
      y: 340,
      size: 22,
    });
    page.drawText(s2, {
      x: 480,
      y: 340,
      size: 22,
    });
    page.drawText(detail, {
      x: 21,
      y: 200,
      size: 21,
    });
    page.drawText(result, {
      x: 38,
      y: 80,
      size: 21,
    });

    let finalPDFBytesKaPromise = pdfdoc.save();
    finalPDFBytesKaPromise.then(function (finalPDFBytes) {
      fs.writeFileSync(matchFileName, finalPDFBytes);
    });
  });
}

function createExcelFile(teams) {
  let wb = new excel4node.Workbook();
  for (let i = 0; i < teams.length; i++) {
    let sheet = wb.addWorksheet(teams[i].name);

    sheet.cell(1, 1).string("VS");
    sheet.cell(1, 2).string("selfScore");
    sheet.cell(1, 3).string("oppScore");
    sheet.cell(1, 4).string("result");
    for (let j = 0; j < teams[i].matches.length; j++) {
      sheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
      sheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
      sheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
      sheet.cell(2 + j, 4).string(teams[i].matches[j].result);
    }
  }

  wb.write(args.excel);
}

function populateTeams(teams, match) {
  let t1indx = teams.findIndex(function (team) {
    if (team.name == match.t1) {
      return true;
    } else {
      return false;
    }
  });

  if (t1indx == -1) {
    teams.push({
      name: match.t1,
      matches: [],
    });
  }

  let t2indx = teams.findIndex(function (team) {
    if (team.name == match.t2) {
      return true;
    } else {
      return false;
    }
  });

  if (t2indx == -1) {
    teams.push({
      name: match.t2,
      matches: [],
    });
  }
}

function populateTeamMatches(teams, match) {
  let t1indx = teams.findIndex(function (team) {
    if (team.name == match.t1) {
      return true;
    } else {
      return false;
    }
  });

  let team1 = teams[t1indx];
  team1.matches.push({
    vs: match.t2,
    selfScore: match.t1s,
    oppScore: match.t2s,
    result: match.result,
    detail: match.detail,
  });

  let t2indx = teams.findIndex(function (team) {
    if (team.name == match.t2) {
      return true;
    } else {
      return false;
    }
  });

  let team2 = teams[t2indx];
  team2.matches.push({
    vs: match.t1,
    selfScore: match.t2s,
    oppScore: match.t1s,
    result: match.result,
    detail: match.detail,
  });
}
