let token=localStorage.getItem("orbit_token"), me=null, queue=[], currentMatch=null, register=false;
const $=id=>document.getElementById(id);
async function api(url,opt={}){opt.headers={...(opt.headers||{}), "Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})};const r=await fetch("http://localhost:3000"+url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d}
function setMsg(x){$("authMsg").textContent=x}
function showApp(){ $("auth").classList.add("hidden");$("app").classList.remove("hidden");$("logout").classList.remove("hidden"); loadDiscover(); loadProfile()}
function showAuth(){ $("auth").classList.remove("hidden");$("app").classList.add("hidden");$("logout").classList.add("hidden")}
$("loginTab").onclick=()=>{register=false;$("loginTab").classList.add("active");$("registerTab").classList.remove("active");document.querySelectorAll(".registerOnly").forEach(x=>x.classList.add("hidden"))}
$("registerTab").onclick=()=>{register=true;$("registerTab").classList.add("active");$("loginTab").classList.remove("active");document.querySelectorAll(".registerOnly").forEach(x=>x.classList.remove("hidden"))}
$("authForm").onsubmit=async e=>{e.preventDefault();try{const body={email:$("email").value,password:$("password").value};if(register)Object.assign(body,{name:$("name").value,age:Number($("age").value),city:$("city").value});const d=await api(register?"/api/auth/register":"/api/auth/login",{method:"POST",body:JSON.stringify(body)});token=d.token;localStorage.setItem("orbit_token",token);me=d.user;showApp()}catch(e){setMsg(e.message)}}
$("logout").onclick=()=>{localStorage.removeItem("orbit_token");token=null;showAuth()}
async function loadDiscover(){try{queue=(await api("/api/discover")).users;renderCard()}catch(e){console.error(e)}}
function renderCard(){
  const u=queue[0];
  if(!u){
    $("card").innerHTML="<div class='shade'><h2>No more profiles</h2><p>Check again later for new people.</p></div>";
    return;
  }
  $("card").style.backgroundImage="url(\"" + (u.photo_url || "assets/orbit-profile.jpg") + "\")";
  $("card").innerHTML="<div class='shade'><h2>" + esc(u.name) + ", " + u.age + " ✓</h2><p>" + esc(u.city || "") + "</p><p>" + esc(u.bio || "") + "</p><button class='ghost' onclick='reportUser(" + u.id + ")'>🚨 Report</button><button class='ghost' onclick='blockUser(" + u.id + ")'>Block</button></div>";
}
$("pass").onclick=()=>{queue.shift();renderCard()}
$("like").onclick=async()=>{const u=queue[0];if(!u)return;try{const d=await api("/api/like/"+u.id,{method:"POST"});queue.shift();renderCard();if(d.matched)alert("❤️ It's a match!")}catch(e){alert(e.message)}}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$(b.dataset.page).classList.remove("hidden");if(b.dataset.page==="matches")loadMatches()})
async function loadMatches(){const d=await api("/api/matches");$("matchList").innerHTML=d.matches.length?d.matches.map(m=>`<div class="match"><span>❤️ ${esc(m.user.name)}</span><button onclick='openChat(${m.id},${JSON.stringify(m.user.name)})'>Chat</button></div>`).join(""):"<p class='small'>No matches yet.</p>"}
async function loadProfile(){const d=await api("/api/me");me=d.user;for(const [id,k] of [["pName","name"],["pAge","age"],["pCity","city"],["pPhoto","photo_url"],["pBio","bio"]])$(id).value=me[k]||""}
$("profileForm").onsubmit=async e=>{e.preventDefault();await api("/api/me",{method:"PUT",body:JSON.stringify({name:$("pName").value,age:Number($("pAge").value),city:$("pCity").value,photo_url:$("pPhoto").value,bio:$("pBio").value})});alert("Profile saved")}
async function openChat(id,name){currentMatch=id;$("chatTitle").textContent="Chat with "+name;document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$("chat").classList.remove("hidden");await loadMessages()}
$("backMatches").onclick=()=>{$("chat").classList.add("hidden");$("matches").classList.remove("hidden");loadMatches()}
async function loadMessages(){const d=await api("/api/messages/"+currentMatch);$("messages").innerHTML=d.messages.map(m=>`<div class="bubble ${m.sender_id===me.id?"mine":""}">${esc(m.body)}</div>`).join("");$("messages").scrollTop=$("messages").scrollHeight}
$("messageForm").onsubmit=async e=>{e.preventDefault();const body=$("message").value;if(!body.trim())return;try{await api("/api/messages/"+currentMatch,{method:"POST",body:JSON.stringify({body})});$("message").value="";await loadMessages()}catch(e){alert(e.message)}}
async function blockUser(id){if(confirm("Block this person?")){await api("/api/block/"+id,{method:"POST"});queue.shift();renderCard()}}
async function reportUser(id){const reason=prompt("Reason for report:","Safety violation");if(reason){await api("/api/report/"+id,{method:"POST",body:JSON.stringify({reason})});await blockUser(id);alert("Report submitted and user blocked.")}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
if(token){api("/api/me").then(d=>{me=d.user;showApp()}).catch(()=>{token=null;localStorage.removeItem("orbit_token");showAuth()})}else showAuth();
