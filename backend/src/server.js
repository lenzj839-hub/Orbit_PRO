const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "orbit-dev-secret-change-me";

app.use(cors());
app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname, "../../frontend")));

const badWords = ["fuck","shit","bitch"];
const phoneRegex = /(?:\+?254|0)[7-9]\d{8}/;

function auth(req,res,next){
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/,"");
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({error:"Authentication required"});
  }
}
function cleanText(s=""){
  return String(s).trim().replace(/[<>]/g,"");
}
function safeBody(s=""){
  const t = cleanText(s).toLowerCase();
  return !phoneRegex.test(t) && !badWords.some(w=>t.includes(w));
}
function publicUser(u){
  return {id:u.id,name:u.name,age:u.age,bio:u.bio,photo_url:u.photo_url,city:u.city};
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"Orbit PRO"}));

app.post("/api/auth/register", async (req,res)=>{
  const {email,password,name,age,bio="",photo_url="",city=""}=req.body;
  if(!email || !password || !name || !Number.isInteger(Number(age)) || Number(age)<18)
    return res.status(400).json({error:"Valid email, password, name and age 18+ are required"});
  if(password.length<8) return res.status(400).json({error:"Password must be at least 8 characters"});
  try{
    const hash=await bcrypt.hash(password,12);
    const info=db.prepare(`INSERT INTO users(email,password_hash,name,age,bio,photo_url,city)
      VALUES(?,?,?,?,?,?,?)`).run(email.toLowerCase().trim(),hash,cleanText(name),Number(age),
      cleanText(bio),cleanText(photo_url),cleanText(city));
    const token=jwt.sign({id:Number(info.lastInsertRowid)},JWT_SECRET,{expiresIn:"7d"});
    res.status(201).json({token,user:publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid))});
  }catch(e){ res.status(409).json({error:"Email may already be registered"}); }
});

app.post("/api/auth/login", async (req,res)=>{
  const u=db.prepare("SELECT * FROM users WHERE email=?").get(String(req.body.email||"").toLowerCase().trim());
  if(!u || !(await bcrypt.compare(String(req.body.password||""),u.password_hash)))
    return res.status(401).json({error:"Invalid email or password"});
  const token=jwt.sign({id:u.id},JWT_SECRET,{expiresIn:"7d"});
  res.json({token,user:publicUser(u)});
});

app.get("/api/me",auth,(req,res)=>{
  const u=db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
  res.json({user:publicUser(u)});
});

app.put("/api/me",auth,(req,res)=>{
  const {name,age,bio,photo_url,city}=req.body;
  if(age!==undefined && Number(age)<18) return res.status(400).json({error:"Users must be 18+"});
  db.prepare(`UPDATE users SET name=COALESCE(?,name),age=COALESCE(?,age),bio=COALESCE(?,bio),
    photo_url=COALESCE(?,photo_url),city=COALESCE(?,city) WHERE id=?`)
    .run(name!==undefined?cleanText(name):null,age!==undefined?Number(age):null,
      bio!==undefined?cleanText(bio):null,photo_url!==undefined?cleanText(photo_url):null,
      city!==undefined?cleanText(city):null,req.user.id);
  res.json({user:publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id))});
});

app.get("/api/discover",auth,(req,res)=>{
  const users=db.prepare(`
    SELECT * FROM users
    WHERE id != ?
      AND id NOT IN (SELECT target_id FROM likes WHERE user_id=?)
      AND id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id=?)
      AND id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id=?)
    ORDER BY RANDOM() LIMIT 20
  `).all(req.user.id,req.user.id,req.user.id,req.user.id);
  res.json({users:users.map(publicUser)});
});

app.post("/api/like/:id",auth,(req,res)=>{
  const target=Number(req.params.id);
  if(!target || target===req.user.id) return res.status(400).json({error:"Invalid user"});
  if(db.prepare("SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?").get(req.user.id,target))
    return res.status(403).json({error:"User blocked"});
  db.prepare("INSERT OR IGNORE INTO likes(user_id,target_id) VALUES(?,?)").run(req.user.id,target);
  const reciprocal=db.prepare("SELECT 1 FROM likes WHERE user_id=? AND target_id=?").get(target,req.user.id);
  if(reciprocal){
    const a=Math.min(req.user.id,target), b=Math.max(req.user.id,target);
    db.prepare("INSERT OR IGNORE INTO matches(user1_id,user2_id) VALUES(?,?)").run(a,b);
  }
  res.json({matched:!!reciprocal});
});

app.get("/api/matches",auth,(req,res)=>{
  const rows=db.prepare(`
    SELECT m.id, CASE WHEN m.user1_id=? THEN m.user2_id ELSE m.user1_id END other_id
    FROM matches m WHERE m.user1_id=? OR m.user2_id=?
    ORDER BY m.created_at DESC
  `).all(req.user.id,req.user.id,req.user.id);
  res.json({matches:rows.map(r=>({id:r.id,user:publicUser(db.prepare("SELECT * FROM users WHERE id=?").get(r.other_id))}))});
});

app.get("/api/messages/:matchId",auth,(req,res)=>{
  const m=db.prepare("SELECT * FROM matches WHERE id=? AND (user1_id=? OR user2_id=?)")
    .get(Number(req.params.matchId),req.user.id,req.user.id);
  if(!m) return res.status(404).json({error:"Match not found"});
  res.json({messages:db.prepare("SELECT id,sender_id,body,created_at FROM messages WHERE match_id=? ORDER BY id").all(m.id)});
});

app.post("/api/messages/:matchId",auth,(req,res)=>{
  const m=db.prepare("SELECT * FROM matches WHERE id=? AND (user1_id=? OR user2_id=?)")
    .get(Number(req.params.matchId),req.user.id,req.user.id);
  const body=cleanText(req.body.body);
  if(!m) return res.status(404).json({error:"Match not found"});
  if(!body || body.length>1000) return res.status(400).json({error:"Message must be 1-1000 characters"});
  if(!safeBody(body)) return res.status(400).json({error:"Message contains prohibited contact or abusive content"});
  const info=db.prepare("INSERT INTO messages(match_id,sender_id,body) VALUES(?,?,?)").run(m.id,req.user.id,body);
  res.status(201).json({message:db.prepare("SELECT id,sender_id,body,created_at FROM messages WHERE id=?").get(info.lastInsertRowid)});
});

app.post("/api/block/:id",auth,(req,res)=>{
  const target=Number(req.params.id);
  db.prepare("INSERT OR IGNORE INTO blocks(blocker_id,blocked_id) VALUES(?,?)").run(req.user.id,target);
  res.json({ok:true});
});

app.post("/api/report/:id",auth,(req,res)=>{
  const target=Number(req.params.id);
  const reason=cleanText(req.body.reason||"Safety violation");
  db.prepare("INSERT INTO reports(reporter_id,reported_id,reason) VALUES(?,?,?)").run(req.user.id,target,reason);
  res.status(201).json({ok:true});
});

app.get("/{*splat}",(req,res)=>res.sendFile(path.join(__dirname,"../../frontend/index.html")));

app.listen(PORT,()=>console.log(`Orbit PRO running on http://localhost:${PORT}`));
