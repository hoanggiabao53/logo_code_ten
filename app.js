const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const TIME_SLOTS = [
  "10:00",
  "13:00",
  "15:00",
  "18:00",
  "20:00",
  "22:00",
  "23:50",
  "01:30",
];
const MAX_SLOTS = 15;
const DATA_FILE = path.join(__dirname, "data", "tournaments.json");
const CONFIG_FILE = path.join(__dirname, "data", "config.json");
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DATA_FILE)))
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
if (!fs.existsSync(CONFIG_FILE))
  fs.writeFileSync(
    CONFIG_FILE,
    JSON.stringify({ adminPin: "2992" }, null, 2),
    "utf8",
  );

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
  const originalRender = res.render;
  res.render = function (view, options, callback) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    originalRender.call(this, view, options, callback);
  };
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

function getTournaments() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}
function saveTournaments(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
}
function getTodayDateString() {
  const now = new Date();
  const vnTime = new Date(
    now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000,
  );
  return `${vnTime.getFullYear()}-${String(vnTime.getMonth() + 1).padStart(2, "0")}-${String(vnTime.getDate()).padStart(2, "0")}`;
}
function getTeamDate(t) {
  if (t && t.date) return String(t.date).trim();
  return getTodayDateString();
}
function getAdminPin() {
  try {
    return String(
      JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")).adminPin || "2992",
    ).trim();
  } catch (e) {
    return "2992";
  }
}
function saveAdminPin(newPin) {
  try {
    let configData = {};
    if (fs.existsSync(CONFIG_FILE))
      configData = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    configData.adminPin = String(newPin).trim();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2), "utf8");
  } catch (e) {}
}
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      list[parts.shift().trim()] = decodeURI(parts.join("="));
    });
  }
  return list;
}

app.get("/", (req, res) => {
  const selectedDate = req.query.date || getTodayDateString();
  const confirmedTeams = getTournaments().filter(
    (t) => t.status === "confirmed" && getTeamDate(t) === selectedDate,
  );
  res.render("index", {
    confirmedTeams,
    selectedDate,
    todayDate: getTodayDateString(),
    TIME_SLOTS,
  });
});

app.get("/register", (req, res) => {
  // BỎ HOÀN TOÀN KIỂM TRA MÃ PIN, KHÁCH VÀO LÀ CHO TẢI LOGO LUÔN
  res.render("register", {
    selectedTimeSlot: req.query.timeSlot || "20:00",
    selectedGroup: req.query.group ? parseInt(req.query.group, 10) : null,
    error: null,
    formData: {},
    TIME_SLOTS,
  });
});

app.post("/register/verify", (req, res) => {
  const { roomCode, timeSlot, group } = req.body;
  const currentPin = getAdminPin(); // Lấy mã PIN từ file config.json (2992)

  // CHỈ CẦN NHẬP ĐÚNG SỐ PIN LÀ QUA
  if ((roomCode || "").trim() === currentPin) {
    return res.redirect(
      `/register?verified=1&timeSlot=${timeSlot || ""}&group=${group || ""}`,
    );
  }

  // BÁO LỖI NẾU SAI
  res.render("register_pass", {
    error: "Mã PIN không đúng. Vui lòng nhập lại!",
    timeSlot,
    group,
  });
});

app.post("/register", upload.single("logo"), async (req, res) => {
  try {
    const { teamName, timeSlot, wantNameCode, group } = req.body;
    const slot = timeSlot || "20:00";
    const requestedGroup = group ? parseInt(group, 10) : null;

    if (!teamName || !teamName.trim() || !req.file) {
      return res.render("register", {
        error: "Vui lòng nhập Tên Team và chọn Logo.",
        selectedTimeSlot: slot,
        selectedGroup: requestedGroup,
        formData: { teamName },
        TIME_SLOTS,
      });
    }

    const teams = getTournaments();
    const teamsInSlot = teams.filter((t) => (t.timeSlot || "20:00") === slot);
    let targetGroup = requestedGroup;

    if (!targetGroup) {
      let g = 1;
      while (true) {
        if (
          teamsInSlot.filter((t) => (parseInt(t.group, 10) || 1) === g).length <
          MAX_SLOTS
        ) {
          targetGroup = g;
          break;
        }
        g++;
      }
    }

    const logoUrl = `/uploads/${req.file.filename}`;
    const isWantCode =
      wantNameCode === "1" || wantNameCode === "true" || wantNameCode === "on";
    let nameCodeData = null;
    if (isWantCode) {
      const members = [];
      for (let i = 1; i <= 5; i++) {
        const uid = (req.body[`codeId_${i}`] || "").trim();
        const name = (req.body[`codeName_${i}`] || "").trim();
        if (uid || name) members.push({ slot: i, uid, name });
      }
      nameCodeData = { enabled: true, members };
    }

    teams.push({
      id: Date.now().toString(),
      teamName: teamName.trim(),
      timeSlot: slot,
      group: targetGroup,
      date: getTodayDateString(),
      logoUrl,
      status: "confirmed",
      nameCode: nameCodeData,
      createdAt: new Date().toISOString(),
    });
    saveTournaments(teams);
    res.redirect(
      `/success?teamName=${encodeURIComponent(teamName)}&timeSlot=${encodeURIComponent(slot)}`,
    );
  } catch (error) {
    res.status(500).send("Lỗi: " + error.message);
  }
});

app.get("/success", (req, res) =>
  res.render("success", {
    teamName: req.query.teamName || "Chiến Đội",
    timeSlot: req.query.timeSlot || "20:00",
  }),
);

app.get("/admin/login", (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.admin_auth === "true") {
    if (cookies.admin_role === "superadmin")
      return res.redirect("/admin?role=superadmin");
    if (cookies.admin_role === "taophong")
      return res.redirect("/admin?role=taophong");
  }
  const requestedRole = req.query.role || "superadmin";
  res.render("admin_login", { error: null, requestedRole });
});

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "1992") {
    return res.redirect("/admin?role=superadmin");
  }
  if (username === "taophong" && password === "2992") {
    return res.redirect("/admin?role=taophong");
  }

  res.render("admin_login", {
    error: "Tài khoản hoặc mật khẩu không đúng!",
    requestedRole: req.body.requestedRole || "superadmin",
  });
});

app.get("/admin/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    "admin_auth=; admin_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  );
  res.redirect("/admin/login");
});

app.get("/admin", (req, res) => {
  const urlRole = req.query.role;

  if (urlRole !== "superadmin" && urlRole !== "taophong") {
    return res.redirect("/admin/login");
  }

  const selectedDate = req.query.date || getTodayDateString();
  const showAllDates = req.query.all === "1";
  const allTeams = getTournaments();
  const confirmedTeams = allTeams.filter(
    (t) =>
      t.status === "confirmed" &&
      (showAllDates || getTeamDate(t) === selectedDate),
  );

  const bracketsMap = {};
  confirmedTeams.forEach((team) => {
    const slot = team.timeSlot || "20:00";
    const groupNum = team.group || 1;
    const key = `${slot} - Bảng ${groupNum}`;
    if (!bracketsMap[key])
      bracketsMap[key] = { key, timeSlot: slot, group: groupNum, teams: [] };
    bracketsMap[key].teams.push(team);
  });

  const sortedBrackets = Object.values(bracketsMap).sort((a, b) => {
    const idxA = TIME_SLOTS.indexOf(a.timeSlot);
    const idxB = TIME_SLOTS.indexOf(b.timeSlot);
    if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
    return a.group - b.group;
  });

  const nameCodeTeams = confirmedTeams.filter(
    (t) => t.nameCode && t.nameCode.enabled && t.nameCode.members.length > 0,
  );

  const commonData = {
    role: urlRole,
    confirmedTeams,
    sortedBrackets,
    nameCodeTeams,
    totalCount: confirmedTeams.length,
    allTimeCount: allTeams.length,
    currentAdminPin: getAdminPin(),
    codeUpdated: req.query.codeUpdated === "1",
    pinUpdated: req.query.pinUpdated === "1",
    resetSuccess: req.query.resetSuccess === "1",
    selectedDate,
    showAllDates,
    todayDate: getTodayDateString(),
    TIME_SLOTS,
  };

  if (urlRole === "superadmin") {
    res.render("admin", commonData);
  } else {
    res.render("taophong", commonData);
  }
});

app.post("/admin/change-pin", (req, res) => {
  if (String(req.body.oldPin).trim() !== getAdminPin())
    return res.redirect("/admin?role=superadmin&pinError=old_pin_incorrect");
  saveAdminPin(req.body.newPin);
  res.redirect("/admin?role=superadmin&pinUpdated=1");
});

app.post("/admin/reset-all", (req, res) => {
  saveTournaments([]);
  if (fs.existsSync(UPLOAD_DIR)) {
    fs.readdirSync(UPLOAD_DIR).forEach((file) => {
      if (file.startsWith("logo-")) {
        try {
          fs.unlinkSync(path.join(UPLOAD_DIR, file));
        } catch (err) {}
      }
    });
  }
  res.redirect("/admin?role=superadmin&resetSuccess=1");
});

app.post("/admin/delete/:id", (req, res) => {
  let teams = getTournaments();
  const teamToDelete = teams.find((t) => t.id === req.params.id);
  if (teamToDelete && teamToDelete.logoUrl) {
    const filePath = path.join(__dirname, "public", teamToDelete.logoUrl);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {}
    }
  }
  teams = teams.filter((t) => t.id !== req.params.id);
  saveTournaments(teams);
  res.redirect("/admin?role=superadmin");
});

app.listen(PORT, () => {
  console.log(`\n🔥 SERVER CHẠY TẠI: http://localhost:${PORT}`);
});
