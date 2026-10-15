// Articles for the goaltending "clothesline" across the top of index.html. One post-it note per line.
// Fields: d = date (YYYY-MM-DD, or "" if unknown), t = title, u = link, s = publisher or journal,
// tp = topic: "dev" (goalie development), "train" (training), "coach" (NHL goalie coaches),
// "stats" (advanced stats), "bio" (biomechanics), "coaching" (goalie coaching),
// m = true for notes added by hand (the research bot never removes these).
// fetch_clothesline.py (the research bot) updates this file every day.
const CLOTHESLINE_UPDATED = "15 October 2026";
const CLOTHESLINE = [
{"d": "2026-10-08", "t": "PWHL Goalie Moves: Nicole Hensley Leads All 46 Camp Invites", "u": "https://ingoalmag.com/2026/10/08/pwhl-training-camp-goalies-2026-27/", "s": "InGoal Magazine", "tp": "dev", "m": false},
{"d": "2026-10-08", "t": "Goalie News: Daily Hockey Goaltending Roundup", "u": "https://ingoalmag.com/2026/10/08/introducing-goalie-news/", "s": "InGoal Magazine", "tp": "coaching", "m": false},
{"d": "2026-07-31", "t": "Analytics Advantage: The Disappearance of the 60-Start Goalie and New Goaltending Trends", "u": "https://dobberhockey.com/2026/07/31/analytics-advantage-the-disappearance-of-the-60-start-goalie-and-new-goaltending-trends/", "s": "DobberHockey", "tp": "stats", "m": false},
{"d": "", "t": "Lower-Extremity Kinematics During Ice Hockey Goaltender Stances", "u": "https://pubmed.ncbi.nlm.nih.gov/42486464/", "s": "Journal of Applied Biomechanics", "tp": "bio", "m": false},
{"d": "", "t": "NHL Goaltending Coaches: Complete Guide", "u": "https://ingoalmag.com/nhl-goaltending-coaches/", "s": "InGoal Magazine", "tp": "coach", "m": false},
{"d": "", "t": "LA Kings Announce Hockey Operations Staff Additions for 2026-27 Season", "u": "https://www.nhl.com/kings/news/la-kings-announce-hockey-operations-staff-additions-2026-27-season", "s": "NHL.com", "tp": "coach", "m": false},
{"d": "", "t": "2026 National Goaltending and Women's Defense Development Camp Invitees and Staff Named", "u": "https://teamusa.usahockey.com/news_article/show/1360766", "s": "USA Hockey", "tp": "dev", "m": false},
{"d": "", "t": "Adjusting How We Evaluate and Analyze Goaltenders", "u": "https://thehockeywriters.com/evaluating-analyzing-goaltenders-changes/", "s": "The Hockey Writers", "tp": "stats", "m": false},
{"d": "", "t": "The Perceived Demands of Ice Hockey Goaltending Movements on the Hip and Groin Region: An Elite Coach and Player Perspective", "u": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8647250/", "s": "PMC", "tp": "bio", "m": false},
{"d": "", "t": "Ice Hockey Goaltender Physiology Profile and Physical Testing: A Review", "u": "https://digitalcommons.wku.edu/cgi/viewcontent.cgi?article=3028&context=ijes", "s": "Int J Exercise Science", "tp": "train", "m": false},
{"d": "", "t": "2026 NHL Draft: Top 15 goaltenders", "u": "https://www.dailyfaceoff.com/news/2026-nhl-draft-top-15-goaltenders-trejbal-borichev-boettiger", "s": "Daily Faceoff", "tp": "dev", "m": false},
{"d": "", "t": "How to Read GSAx: A Simple Guide to Understanding Goalie Performance", "u": "https://tapetotapemk.substack.com/p/why-save-percentage-isnt-enough-a", "s": "Tape to Tape", "tp": "stats", "m": false},
{"d": "", "t": "New Jersey Devils make four changes to coaching, development staff", "u": "https://www.dailyfaceoff.com/news/new-jersey-devils-make-four-changes-coaching-development-staff-nhl-news", "s": "Daily Faceoff", "tp": "coach", "m": false},
{"d": "", "t": "Generals add new goalie coach", "u": "https://chl.ca/ohl-generals/article/generals-add-new-goalie-coach/", "s": "CHL", "tp": "coaching", "m": false},
{"d": "2025-06-10", "t": "Pro Training with Kristen Campbell and James Wendland", "u": "https://ingoalmag.com/2025/06/10/pro-training-with-kristen-campbell-and-james-wendland/", "s": "InGoal Magazine", "tp": "train", "m": true},
{"d": "2024-11-19", "t": "Teaching Young Goalies to \"Be a Pro\" (InGoal Radio Ep. 280)", "u": "https://ingoalmag.com/2024/11/19/podcast-segment-for-goalie-parents-episode-280-learning-to-be-a-pro-at-a-young-age/", "s": "InGoal Magazine", "tp": "coaching", "m": true},
{"d": "2023-07-14", "t": "5 Damn Things to Improve Goalie Hip Health", "u": "https://ingoalmag.com/2023/07/14/5-damn-things-to-improve-goalie-hip-health/", "s": "InGoal Magazine", "tp": "train", "m": true}
];
