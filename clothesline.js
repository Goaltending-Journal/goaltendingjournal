// Articles for the goaltending "clothesline" across the top of index.html. One post-it note per line.
// Fields: d = date (YYYY-MM-DD, or "" if unknown), t = title, u = link, s = journal, lab or publisher,
// tp = topic: "dev" (goalie development), "train" (training), "coaching" (goalie coaching),
// "stats" (advanced stats), "bio" (biomechanics), "ed" (ecological dynamics), "sa" (skill acquisition),
// m = true for notes added by hand (the research bot never removes these).
// fetch_clothesline.py (the research bot) updates this file every day.
const CLOTHESLINE_UPDATED = "15 October 2026";
const CLOTHESLINE = [
{"d": "", "t": "Ice hockey goaltenders' gaze behavior: differences between elites and amateurs", "u": "https://link.springer.com/article/10.1007/s11332-026-01774-x", "s": "Sport Sciences for Health", "tp": "dev", "m": false},
{"d": "", "t": "Lower-Extremity Kinematics During Ice Hockey Goaltender Stances", "u": "https://pubmed.ncbi.nlm.nih.gov/42486464/", "s": "Journal of Applied Biomechanics", "tp": "bio", "m": false},
{"d": "", "t": "Towards an ecological dynamics theory of flow in sport", "u": "https://www.sciencedirect.com/science/article/pii/S0001691825000782", "s": "Acta Psychologica", "tp": "ed", "m": false},
{"d": "", "t": "The ecological dynamics of cognizant action in sport", "u": "https://www.sciencedirect.com/science/article/pii/S1469029225001347", "s": "Psychology of Sport and Exercise", "tp": "ed", "m": false},
{"d": "", "t": "Perceptual Training in Ice Hockey: Bridging the Eyes-Puck Gap Using Virtual Reality", "u": "https://sportsmedicine-open.springeropen.com/articles/10.1186/s40798-025-00840-x", "s": "Sports Medicine - Open", "tp": "train", "m": false},
{"d": "", "t": "Ecological Dynamics as an Accurate and Parsimonious Contributor to Applied Practice: A Critical Appraisal", "u": "https://link.springer.com/article/10.1007/s40279-024-02161-7", "s": "Sports Medicine", "tp": "ed", "m": false},
{"d": "", "t": "Affordances for throwing: An uncontrolled manifold analysis", "u": "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0301320", "s": "PLOS ONE", "tp": "sa", "m": false},
{"d": "", "t": "Beyond a One-Size-Fits-All Approach to Coaching", "u": "https://emergentmvmt.com/beyond-a-one-size-fits-all-approach-to-coaching/", "s": "Emergence (Myszka & Yearby)", "tp": "coaching", "m": false},
{"d": "", "t": "The Eventual Evolution of Ecological Dynamics", "u": "https://emergentmvmt.com/the-eventual-evolution-of-ecological-dynamics/", "s": "Emergence (Myszka & Yearby)", "tp": "ed", "m": false},
{"d": "", "t": "The Perceived Demands of Ice Hockey Goaltending Movements on the Hip and Groin Region: An Elite Coach and Player Perspective", "u": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8647250/", "s": "PubMed Central", "tp": "bio", "m": false},
{"d": "", "t": "Ice Hockey Goaltender Physiology Profile and Physical Testing: A Review", "u": "https://digitalcommons.wku.edu/cgi/viewcontent.cgi?article=3028&context=ijes", "s": "International Journal of Exercise Science", "tp": "train", "m": false},
{"d": "", "t": "Sport Practitioners as Sport Ecology Designers: How Ecological Dynamics Has Progressively Changed Perceptions of Skill \"Acquisition\" in the Sporting Habitat", "u": "https://philpapers.org/rec/WOOSPA-10", "s": "Woods, Araújo, Davids et al.", "tp": "sa", "m": false},
{"d": "", "t": "Rob Gray's skill acquisition and coaching books", "u": "https://perceptionaction.com/book/", "s": "Perception & Action (Rob Gray)", "tp": "sa", "m": true},
{"d": "", "t": "The Constraints-Led Approach: Principles for Sports Coaching and Practice Design", "u": "https://eprints.glos.ac.uk/6693/", "s": "Renshaw, Davids, Newcombe & Roberts", "tp": "coaching", "m": true},
{"d": "", "t": "The Ecological Approach to Visual Perception (Classic Edition)", "u": "https://www.routledge.com/The-Ecological-Approach-to-Visual-Perception-Classic-Edition/Gibson/p/book/9781848725782", "s": "James J. Gibson · Routledge", "tp": "ed", "m": true},
{"d": "", "t": "Quiet eye predicts goaltender success in deflected ice hockey shots", "u": "https://pubmed.ncbi.nlm.nih.gov/26949176/", "s": "European Journal of Sport Science", "tp": "sa", "m": true},
{"d": "", "t": "DIGR: A Defense Independent Rating of NHL Goaltenders Using Spatially Smoothed Save Percentage Maps", "u": "https://www.sloansportsconference.com/research-papers/digr-a-defense-independent-rating-of-nhl-goaltenders-using-spatially-smoothed-save-percentage-maps", "s": "MIT Sloan Sports Analytics Conference", "tp": "stats", "m": true},
{"d": "", "t": "Evaluating NHL Goalies, Skaters, and Teams Using Weighted Shots", "u": "https://arxiv.org/abs/1205.1746", "s": "arXiv", "tp": "stats", "m": true}
];
