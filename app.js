const SUPABASE_URL='https://czofyrwvzbdnmngrhgqj.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6b2Z5cnd2emJkbm1uZ3JoZ3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDI1MjEsImV4cCI6MjA4OTcxODUyMX0.GExE-ZSCwa09sUD0F0twHvzZLM31_9iThcHaFnOU8lY';
const OPENAI_KEY='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';
const MASTER_EMAIL='xavellis4@gmail.com';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let currentUser=null,chartInstance=null;
let chartData={streak:[],tasks:[],wins:[]};
let bgParticles=[],bgAnimFrame=null,bgEmoji='none';
let journalData=[],calViewDate=new Date();
let fireworksActive=false,allTasksDoneFired=false;
let userRole='member',viewMode='member',selectedRole='member',authTabMode='signin';
let rtInterval=null,rtSeconds=90,rtRunning=false;
let currentStep=0,onboardAnswers={};
let tempTasks=[],tempMovement=['Weights','Cardio','HIIT','Walk / run','Stretch / yoga','Rest day'];

const ACCENT_LEVELS=[{days:0,color:'#1D9E75'},{days:7,color:'#FAC775'},{days:30,color:'#7F77DD'},{days:60,color:'#5DCAA5'},{days:90,color:'#FFD700'}];
const ACCENT_COLORS=['#1D9E75','#378ADD','#7F77DD','#FAC775','#D85A30','#E24B4A'];
const TAGLINES=['Greatness loading...','Your best self is being built...','No shortcuts. Just results.','The grind never waits.','Champions are made in the dark.','Every rep counts.','Discipline is freedom.'];

let prefs={
  name:'',goal:'',goalLength:'90 days',motivator:'',tone:'Brutal',profanity:true,fears:'',
  onboarding_complete:false,smokes:'Neither',drinks:'No',bgEmoji:'none',colorShift:true,
  fitnessLevel:'intermediate',customHabits:[],
  tasks:[],
  movementTypes:['Weights','Cardio','HIIT','Walk / run','Stretch / yoga','Rest day'],
  bodyTasks:[{id:'gym',label:'Gym / movement completed',category:'body'},{id:'water',label:'Hydration (1 gallon)',category:'body'},{id:'sleep',label:'7+ hours sleep',category:'body'}],
  tiers:[{name:'First milestone',days:7,desc:'Hit your targets 5/7 days',reward:'Set your own reward',color:'#FAC775'},{name:'Second milestone',days:30,desc:'30 days consistent',reward:'Set your own reward',color:'#AFA9EC'},{name:'Third milestone',days:60,desc:'60 days consistent',reward:'Set your own reward',color:'#5DCAA5'},{name:'Final milestone',days:90,desc:'90 days — full cycle complete',reward:'Set your own reward',color:'#7F77DD'}],
  accentColor:'#1D9E75',defaultTab:'home',density:'compact',metric:'us'
};

let state={streak:0,soberStreak:0,gymStreak:0,dayCount:1,soberDays:0,gymDays:0,selectedResult:'',soberItems:{},gymType:''};

const universalQuotes=[
  {text:"The impediment to action advances action. What stands in the way becomes the way.",author:"Marcus Aurelius"},
  {text:"You have power over your mind, not outside events.",author:"Marcus Aurelius"},
  {text:"Do not pray for an easy life. Pray for the strength to endure a difficult one.",author:"Bruce Lee"},
  {text:"Fall seven times, stand up eight.",author:"Japanese Proverb"},
  {text:"Suffer the pain of discipline or suffer the pain of regret.",author:"Jim Rohn"},
  {text:"Either you run the day or the day runs you.",author:"Jim Rohn"},
  {text:"Work like there is someone working 24 hours a day to take it all away from you.",author:"Mark Cuban"},
  {text:"Discipline is the bridge between goals and accomplishment.",author:"Jim Rohn"},
  {text:"Don't count the days. Make the days count.",author:"Muhammad Ali"},
  {text:"The secret of getting ahead is getting started.",author:"Mark Twain"},
  {text:"Success is walking from failure to failure with no loss of enthusiasm.",author:"Winston Churchill"},
  {text:"Chase the vision, not the money. The money will end up following you.",author:"Tony Hsieh"}
];
const operatorQuotes=["I move with precision, not emotion.","Consistency beats intensity — I show up daily.","Data over emotion. I trust numbers, not opinions.","I do not chase — I position.","I am disciplined when it's inconvenient. I execute when it's boring.","My body is infrastructure. I protect it like capital.","Every rep counts. Every day matters.","You don't need motivation. You need a system.","The system runs. I execute.","Built different starts with deciding differently."];

const SAMPLE_EXERCISES=[
  {name:'Barbell Hip Raise — Hovering',sets:5,reps:'8–10',tempo:'2021',rest:120,muscle:'Glutes',notes:'Drive through heels. Full glute squeeze 1 sec at top.'},
  {name:'BB Bulgarian Lunge',sets:4,reps:'6–8',tempo:'3111',rest:120,muscle:'Quads / Glutes',notes:'Knee tracks over 2nd toe. Increase weight sets 2–3.'},
  {name:'B Stance Single Leg RDL',sets:4,reps:'8–10',tempo:'3111',rest:120,muscle:'Hamstrings',notes:'Hinge not squat. Don\'t let hip open.'},
  {name:'Deficit Single Leg Calve Raise',sets:4,reps:'10–12',tempo:'1231',rest:90,muscle:'Calves',notes:'Full stretch at bottom. Hard flex at top.'},
  {name:'Weighted Leg Lowers',sets:3,reps:'60 sec',tempo:'—',rest:90,muscle:'Core',notes:'Stay in working range. Track numbers.'},
];

const SAMPLE_MEALS=[
  {time:'7:00am',name:'Breakfast',desc:'3 egg whites + 2 whole eggs, oats with berries, black coffee',cal:480,p:38,c:52,f:12},
  {time:'10:00am',name:'Morning snack',desc:'Greek yogurt, handful almonds, apple',cal:280,p:18,c:24,f:10},
  {time:'1:00pm',name:'Lunch',desc:'Grilled chicken breast, brown rice, mixed greens, olive oil',cal:520,p:48,c:44,f:14},
  {time:'4:00pm',name:'Pre-workout',desc:'Banana, Progressive whey protein shake',cal:280,p:32,c:28,f:4},
  {time:'7:30pm',name:'Dinner',desc:'Salmon fillet, sweet potato, broccoli, lemon',cal:480,p:42,c:36,f:14},
  {time:'9:30pm',name:'Evening',desc:'Cottage cheese, casein protein or Iron Vegan blend',cal:180,p:28,c:8,f:4},
];

// ── FIREWORKS ──────────────────────────────────────────────
let fwParticles=[];
function launchFireworks(){
  const canvas=document.getElementById('fireworksCanvas');
  canvas.style.display='block';canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  fwParticles=[];fireworksActive=true;
  for(let b=0;b<6;b++){
    setTimeout(()=>{
      const x=Math.random()*canvas.width,y=Math.random()*canvas.height*.6+50;
      const colors=['#FAC775','#1D9E75','#7F77DD','#D85A30','#fff','#FFD700'];
      const color=colors[Math.floor(Math.random()*colors.length)];
      for(let i=0;i<40;i++){
        const angle=Math.random()*Math.PI*2,speed=Math.random()*6+2;
        fwParticles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,alpha:1,color,size:Math.random()*3+1});
      }
    },b*200);
  }
  animateFireworks();
  setTimeout(()=>{fireworksActive=false;document.getElementById('fireworksCanvas').style.display='none';fwParticles=[];},3000);
}
function animateFireworks(){
  if(!fireworksActive)return;
  const canvas=document.getElementById('fireworksCanvas');
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  fwParticles=fwParticles.filter(p=>p.alpha>0.01);
  fwParticles.forEach(p=>{ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.alpha*=0.96;});
  ctx.globalAlpha=1;
  if(fireworksActive)requestAnimationFrame(animateFireworks);
}

// ── BG ────────────────────────────────────────────────────
const EMOJI_SETS={'🔥':['🔥'],'⚡':['⚡'],'👑':['👑'],'💎':['💎'],'random':['🔥','⚡','👑','💎','🚀','⭐','🏆'],'none':[]};
function initBg(){
  const canvas=document.getElementById('bgCanvas');
  if(!canvas)return;
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  const emojis=EMOJI_SETS[bgEmoji]||[];
  if(!emojis.length){canvas.style.display='none';return;}
  canvas.style.display='block';
  bgParticles=Array.from({length:25},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,emoji:emojis[Math.floor(Math.random()*emojis.length)],size:Math.random()*16+10,speedY:-(Math.random()*.3+.1),speedX:(Math.random()-.5)*.2,opacity:Math.random()*.4+.1}));
  if(bgAnimFrame)cancelAnimationFrame(bgAnimFrame);
  animateBg();
}
function animateBg(){
  const canvas=document.getElementById('bgCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  bgParticles.forEach(p=>{ctx.font=`${p.size}px serif`;ctx.globalAlpha=p.opacity;ctx.fillText(p.emoji,p.x,p.y);p.y+=p.speedY;p.x+=p.speedX;if(p.y<-20){p.y=canvas.height+20;p.x=Math.random()*canvas.width;}});
  ctx.globalAlpha=1;
  bgAnimFrame=requestAnimationFrame(animateBg);
}
window.addEventListener('resize',()=>{const c=document.getElementById('bgCanvas');if(c){c.width=window.innerWidth;c.height=window.innerHeight;}});
function updateAccentColor(){if(!prefs.colorShift)return;let level=ACCENT_LEVELS[0];for(const l of ACCENT_LEVELS)if(state.streak>=l.days)level=l;document.documentElement.style.setProperty('--accent',level.color);}

// ── SESSION STATE ──────────────────────────────────────────
function saveTodayState(){
  const key='fs_today_'+new Date().toISOString().split('T')[0];
  const s={};
  (prefs.tasks||[]).forEach(t=>{const chk=document.getElementById('chk-'+t.id);const inp=document.getElementById('inp-'+t.id);if(chk)s['chk-'+t.id]=chk.className;if(inp)s['inp-'+t.id]=inp.value;});
  (prefs.bodyTasks||[]).forEach(t=>{const chk=document.getElementById('chk-'+t.id);if(chk)s['chk-'+t.id]=chk.className;});
  Object.keys(state.soberItems).forEach(k=>{s['sober-'+k]=state.soberItems[k];});
  s.gymType=state.gymType;s.selectedResult=state.selectedResult;
  s.mood=document.querySelector('#moodRow .mood-btn.selected')?.textContent||'';
  s.focusWord=document.getElementById('focusWord')?.value||'';
  s.winQ1=document.getElementById('winQ1')?.value||'';
  s.winQ2=document.getElementById('winQ2')?.value||'';
  s.missQ1=document.getElementById('missQ1')?.value||'';
  s.missQ2=document.getElementById('missQ2')?.value||'';
  localStorage.setItem(key,JSON.stringify(s));
}
function restoreTodayState(){
  const key='fs_today_'+new Date().toISOString().split('T')[0];
  const saved=localStorage.getItem(key);
  if(!saved)return;
  try{
    const s=JSON.parse(saved);
    (prefs.tasks||[]).forEach(t=>{const chk=document.getElementById('chk-'+t.id);const inp=document.getElementById('inp-'+t.id);if(chk&&s['chk-'+t.id])chk.className=s['chk-'+t.id];if(inp&&s['inp-'+t.id])inp.value=s['inp-'+t.id];if(chk&&(chk.classList.contains('done')||chk.classList.contains('gym-done'))){const lbl=document.getElementById('lbl-'+t.id);if(lbl)lbl.classList.add('done-text');}});
    (prefs.bodyTasks||[]).forEach(t=>{const chk=document.getElementById('chk-'+t.id);if(chk&&s['chk-'+t.id])chk.className=s['chk-'+t.id];if(chk&&(chk.classList.contains('done')||chk.classList.contains('gym-done'))){const lbl=document.getElementById('lbl-'+t.id);if(lbl)lbl.classList.add('done-text');}});
    Object.keys(state.soberItems).forEach(k=>{if(s['sober-'+k]!==undefined){state.soberItems[k]=s['sober-'+k];const el=document.getElementById('sober-'+k);if(el&&s['sober-'+k])el.classList.add('clean');}});
    if(s.gymType){state.gymType=s.gymType;document.querySelectorAll('#gymTypeRow .gym-btn').forEach(b=>{if(b.textContent===s.gymType)b.classList.add('selected');});}
    if(s.mood)document.querySelectorAll('#moodRow .mood-btn').forEach(b=>{if(b.textContent===s.mood)b.classList.add('selected');});
    if(s.focusWord){const fw=document.getElementById('focusWord');if(fw)fw.value=s.focusWord;}
    if(s.selectedResult){state.selectedResult=s.selectedResult;selectResult(s.selectedResult);['winQ1','winQ2','missQ1','missQ2'].forEach(id=>{if(s[id]){const el=document.getElementById(id);if(el)el.value=s[id];}});}
    updateProgress();
  }catch(e){}
}
function resetDayState(){
  localStorage.removeItem('fs_today_'+new Date().toISOString().split('T')[0]);
  (prefs.tasks||[]).forEach(t=>{const chk=document.getElementById('chk-'+t.id);const lbl=document.getElementById('lbl-'+t.id);const inp=document.getElementById('inp-'+t.id);if(chk)chk.className='task-check';if(lbl)lbl.classList.remove('done-text');if(inp)inp.value='';});
  (prefs.bodyTasks||[]).forEach(t=>{const chk=document.getElementById('chk-'+t.id);const lbl=document.getElementById('lbl-'+t.id);if(chk)chk.className='task-check';if(lbl)lbl.classList.remove('done-text');});
  document.querySelectorAll('#gymTypeRow .gym-btn').forEach(b=>b.classList.remove('selected'));
  document.querySelectorAll('.sober-item').forEach(el=>el.classList.remove('clean'));
  document.querySelectorAll('#moodRow .mood-btn').forEach(b=>b.classList.remove('selected'));
  ['focusWord','winQ1','winQ2','missQ1','missQ2'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('debriefSection').style.display='none';
  document.getElementById('winDebrief').style.display='none';
  document.getElementById('missDebrief').style.display='none';
  document.getElementById('consequenceBox').style.display='none';
  document.getElementById('winBtn').className='debrief-btn';
  document.getElementById('missBtn').className='debrief-btn';
  document.getElementById('allDoneBanner').style.display='none';
  state.selectedResult='';state.gymType='';
  Object.keys(state.soberItems).forEach(k=>{state.soberItems[k]=false;});
  updateProgress();
}

// ── AUTH ──────────────────────────────────────────────────
function showAuth(){
  document.getElementById('authScreen').style.display='flex';
  document.getElementById('loadScreen').classList.remove('show');
  document.getElementById('onboardScreen').classList.remove('show');
  document.getElementById('mainApp').classList.remove('show');
}

function selectRole(role,btn){selectedRole=role;document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('on'));btn.classList.add('on');}

function switchAuthTab(tab){
  authTabMode=tab;
  document.getElementById('siTab').classList.toggle('on',tab==='signin');
  document.getElementById('suTab').classList.toggle('on',tab==='signup');
  document.getElementById('authSubmitBtn').textContent=tab==='signin'?'Sign in':'Create account';
  document.getElementById('nameRow').style.display=tab==='signup'?'block':'none';
  document.getElementById('authErr').textContent='';
}

async function handleAuth(){
  const email=document.getElementById('authEmail').value.trim();
  const pass=document.getElementById('authPass').value;
  const btn=document.getElementById('authSubmitBtn');
  const err=document.getElementById('authErr');
  if(!email||!pass){err.textContent='Please fill in all fields.';return;}
  btn.disabled=true;btn.textContent='Loading...';err.textContent='';
  try{
    let result;
    if(authTabMode==='signin'){
      result=await sb.auth.signInWithPassword({email,password:pass});
    }else{
      const fn=document.getElementById('authFN')?.value.trim()||'';
      const ln=document.getElementById('authLN')?.value.trim()||'';
      result=await sb.auth.signUp({email,password:pass,options:{data:{first_name:fn,last_name:ln}}});
    }
    if(result.error)throw result.error;
    if(result.data?.user){
      if(authTabMode==='signup'&&!result.data.session){
        err.style.color='var(--accent)';err.textContent='Account created! Check your email to confirm.';
        btn.disabled=false;btn.textContent='Create account';return;
      }
      currentUser=result.data.user;
      localStorage.setItem('fs_role',selectedRole);
      showLoadingThenApp();
    }
  }catch(e){
    err.textContent=e.message||'Something went wrong.';
    btn.disabled=false;btn.textContent=authTabMode==='signin'?'Sign in':'Create account';
  }
}

async function googleAuth(){
  const{error}=await sb.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo:window.location.origin+window.location.pathname}
  });
  if(error)document.getElementById('authErr').textContent=error.message;
}

async function signOut(){
  await sb.auth.signOut();
  currentUser=null;
  localStorage.removeItem('fs_prefs');
  showAuth();
}

function showLoadingThenApp(){
  document.getElementById('authScreen').style.display='none';
  const ls=document.getElementById('loadScreen');
  ls.classList.add('show');
  const bar=document.getElementById('loadBar'),status=document.getElementById('loadStatus'),tag=document.getElementById('loadTag');
  const phases=[{p:20,s:'Connecting',t:TAGLINES[0]},{p:45,s:'Loading profile',t:TAGLINES[1]},{p:70,s:'Building your system',t:TAGLINES[2]},{p:90,s:'Almost ready',t:TAGLINES[3]}];
  let i=0;
  const tick=setInterval(()=>{if(i<phases.length){bar.style.width=phases[i].p+'%';status.textContent=phases[i].s;tag.textContent=phases[i].t;i++;}},400);
  setTimeout(async()=>{
    clearInterval(tick);bar.style.width='100%';status.textContent='Ready';
    await loadPrefs();await loadFromDB();
    bgEmoji=prefs.bgEmoji||'none';
    await new Promise(r=>setTimeout(r,500));
    ls.style.transition='opacity .5s';ls.style.opacity='0';
    setTimeout(()=>{
      ls.classList.remove('show');ls.style.opacity='';ls.style.transition='';
      if(!prefs.onboarding_complete){buildOnboarding();document.getElementById('onboardScreen').classList.add('show');}
      else showMainApp();
    },500);
  },2200);
}

// ── PREFS / DB ────────────────────────────────────────────
async function savePrefs(){
  localStorage.setItem('fs_prefs',JSON.stringify(prefs));
  if(!currentUser)return;
  try{await sb.from('user_prefs').upsert({user_id:currentUser.id,name:prefs.name||'',goal:prefs.goal||'',goalLength:prefs.goalLength||'90 days',motivator:prefs.motivator||'',tone:prefs.tone||'Brutal',profanity:!!prefs.profanity,fears:prefs.fears||'',onboarding_complete:!!prefs.onboarding_complete},{onConflict:'user_id'});}catch(e){}
}
async function loadPrefs(){
  const local=localStorage.getItem('fs_prefs');
  if(local)try{prefs=Object.assign(prefs,JSON.parse(local));}catch(e){}
  if(!currentUser)return;
  try{const{data}=await sb.from('user_prefs').select('*').eq('user_id',currentUser.id).single();if(data){prefs.name=data.name||prefs.name;prefs.goal=data.goal||prefs.goal;prefs.goalLength=data.goalLength||prefs.goalLength;prefs.motivator=data.motivator||prefs.motivator;prefs.tone=data.tone||prefs.tone;prefs.profanity=data.profanity!==undefined?data.profanity:prefs.profanity;prefs.fears=data.fears||prefs.fears;prefs.onboarding_complete=data.onboarding_complete||false;localStorage.setItem('fs_prefs',JSON.stringify(prefs));}}catch(e){}
}
async function loadFromDB(){
  if(!currentUser)return;
  try{
    const{data}=await sb.from('daily_logs').select('*').eq('user_id',currentUser.id).order('log_date',{ascending:false}).limit(30);
    if(data?.length>0){const l=data[0];state.streak=l.biz_streak||0;state.soberStreak=l.sober_streak||0;state.gymStreak=l.gym_streak||0;state.soberDays=l.sober_days||0;state.gymDays=l.gym_days||0;state.dayCount=l.day_count||1;chartData.streak=data.slice(0,14).reverse().map(d=>d.biz_streak||0);chartData.tasks=data.slice(0,14).reverse().map(d=>d.is_win?1:0);chartData.wins=data.slice(0,14).reverse().map(d=>d.is_win?100:0);}
  }catch(e){}
}
async function saveToDB(logData){
  if(!currentUser)return;
  try{
    const today=new Date().toISOString().split('T')[0];
    await sb.from('daily_logs').upsert({user_id:currentUser.id,log_date:today,biz_streak:logData.streak,gym_streak:logData.gymStreak,sober_streak:logData.soberStreak,sober_days:logData.soberDays,gym_days:logData.gymDays,day_count:logData.dayCount,is_win:logData.isWin,is_sober:logData.fullySober,is_gym:logData.gymDone,mood:document.getElementById('focusWord')?.value||'',focus_word:document.getElementById('focusWord')?.value||'',gym_type:state.gymType||'',journal_win1:state.journalWin1||'',journal_win2:state.journalWin2||'',journal_miss1:state.journalMiss1||'',journal_miss2:state.journalMiss2||''},{onConflict:'user_id,log_date'});
    flashSave();
  }catch(e){}
}

// ── ONBOARDING ────────────────────────────────────────────
const onboardSteps=[
  {id:'name',type:'input',q:"What's your name?",sub:"How should the app address you?",placeholder:"Your first name",key:'name'},
  {id:'goal',type:'input',q:"What are you building?",sub:"Your main goal — business, fitness, income.",placeholder:"e.g. Fitness coaching, $10K/month, lean muscle",key:'goal'},
  {id:'goalLength',type:'single',q:"What's your timeline?",sub:"How long are you committing?",key:'goalLength',options:['30 days','60 days','90 days','6 months','1 year']},
  {id:'motivator',type:'input',q:"Who do you do this for?",sub:"Who in your life drives you most?",placeholder:"e.g. My partner, my kids, myself",key:'motivator'},
  {id:'fitnessLevel',type:'single',q:"Current fitness level?",sub:"This scales your physical consequences.",key:'fitnessLevel',options:['Beginner — just getting started','Intermediate — I train regularly','Advanced — I train hard most days']},
  {id:'smokes',type:'single',q:"Do you smoke?",sub:"Determines what we track in your daily check-in.",key:'smokes',options:['Cigarettes','Weed','Both','Neither — I don\'t smoke']},
  {id:'drinks',type:'single',q:"Do you drink alcohol?",sub:"Be honest — this is your accountability tool.",key:'drinks',options:['Yes — regularly','Socially','No — I don\'t drink']},
  {id:'tone',type:'single',q:"How do you want to be spoken to?",sub:"When you miss a day — what hits hardest?",key:'tone',options:['Hard — direct and blunt','Brutal — no mercy, no excuses','Motivational — tough love','Balanced — mix of all three']},
  {id:'profanity',type:'single',q:"Profanity in coaching messages?",sub:"Raw language or clean — your call.",key:'profanity',options:['Yes — keep it real','No — keep it clean']},
  {id:'fears',type:'input',q:"What's your biggest fear if you don't execute?",sub:"This gets used against you when you slip.",placeholder:"e.g. Staying broke, letting my family down",key:'fears'},
  {id:'tasks',type:'tasks',q:"Build your daily task list.",sub:"Your non-negotiables. Add what matters to your specific goal."},
  {id:'movement',type:'movement',q:"What movement types matter to you?",sub:"Select all that apply."},
  {id:'bgEmoji',type:'bgpick',q:"Pick your vibe.",sub:"Floating background — subtle and personal."}
];

function buildOnboarding(){
  document.getElementById('onboardProgress').innerHTML=onboardSteps.map((s,i)=>`<div class="onboard-pip ${i===0?'current':''}"></div>`).join('');
  document.getElementById('onboardSteps').innerHTML=onboardSteps.map((s,i)=>{
    let html=`<div class="onboard-step ${i===0?'active':''}" id="step-${i}"><div class="onboard-q">${s.q}</div><div class="onboard-sub">${s.sub}</div>`;
    if(s.type==='input')html+=`<input class="onboard-input" id="ob-${s.key}" placeholder="${s.placeholder||''}" value="${String(prefs[s.key]||'')}"/>`;
    else if(s.type==='single'){const cur=String(prefs[s.key]||'');html+=`<div class="onboard-options">${s.options.map(o=>`<button class="onboard-option ${cur&&o.toLowerCase().startsWith(cur.toLowerCase().split(' — ')[0])?'selected':''}" onclick="selectOO(this,'${s.key}')">${o}</button>`).join('')}</div>`;}
    else if(s.type==='tasks')html+=`<div style="font-size:13px;color:var(--text2);margin-bottom:12px;">Add tasks that match your specific goal.</div><div id="ob-task-builder">${tempTasks.map((t,ti)=>`<div class="task-builder-row"><input class="task-builder-input" id="ob-task-name-${ti}" placeholder="Task name" value="${t.label}"/><input class="task-builder-num" id="ob-task-target-${ti}" type="number" min="0" max="999" placeholder="—" value="${t.target||''}"/><button class="task-builder-del" onclick="removeOT(${ti})">✕</button></div>`).join('')}</div><button class="add-btn" onclick="addOT()">+ Add task</button>`;
    else if(s.type==='movement'){const allMov=['Weights','Cardio','HIIT','Walk / run','Stretch / yoga','Rest day','Swimming','Boxing','Cycling','Yoga','Pilates','Sports'];html+=`<div class="movement-chips" id="ob-movement-chips">${allMov.map(m=>`<button class="movement-chip ${tempMovement.includes(m)?'selected':''}" onclick="toggleMC(this,'${m}')">${m}</button>`).join('')}</div><input class="onboard-input" id="ob-custom-movement" placeholder="Add custom type..."/><button class="add-btn" onclick="addCM()">+ Add</button>`;}
    else if(s.type==='bgpick'){const opts=[{v:'none',e:'—'},{v:'🔥',e:'🔥'},{v:'⚡',e:'⚡'},{v:'👑',e:'👑'},{v:'💎',e:'💎'},{v:'random',e:'🎲'}];html+=`<div class="bg-picker">${opts.map(o=>`<button class="bg-option ${(prefs.bgEmoji||'none')===o.v?'selected':''}" onclick="selectBO(this,'${o.v}')">${o.e}</button>`).join('')}</div>`;}
    html+=`</div>`;return html;
  }).join('');
}
function selectOO(btn,key){btn.closest('.onboard-options').querySelectorAll('.onboard-option').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');onboardAnswers[key]=btn.textContent.split(' — ')[0];}
function removeOT(i){tempTasks.splice(i,1);rebuildOT();}
function addOT(){tempTasks.push({id:'task_'+Date.now(),label:'',target:null,category:'custom'});rebuildOT();}
function rebuildOT(){document.getElementById('ob-task-builder').innerHTML=tempTasks.map((t,ti)=>`<div class="task-builder-row"><input class="task-builder-input" id="ob-task-name-${ti}" placeholder="Task name" value="${t.label}"/><input class="task-builder-num" id="ob-task-target-${ti}" type="number" min="0" max="999" placeholder="—" value="${t.target||''}"/><button class="task-builder-del" onclick="removeOT(${ti})">✕</button></div>`).join('');}
function saveOT(){prefs.tasks=tempTasks.map((t,i)=>({id:t.id||'task_'+i,label:document.getElementById('ob-task-name-'+i)?.value.trim()||t.label,target:parseInt(document.getElementById('ob-task-target-'+i)?.value)||null,category:t.category||'custom'})).filter(t=>t.label);}
function toggleMC(btn,val){btn.classList.toggle('selected');if(btn.classList.contains('selected')){if(!tempMovement.includes(val))tempMovement.push(val);}else tempMovement=tempMovement.filter(v=>v!==val);}
function addCM(){const inp=document.getElementById('ob-custom-movement');const val=inp?.value.trim();if(!val)return;if(!tempMovement.includes(val))tempMovement.push(val);const chips=document.getElementById('ob-movement-chips');if(chips){const btn=document.createElement('button');btn.className='movement-chip selected';btn.textContent=val;btn.onclick=()=>toggleMC(btn,val);chips.appendChild(btn);}if(inp)inp.value='';}
function selectBO(btn,val){document.querySelectorAll('.bg-option').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');onboardAnswers.bgEmoji=val;bgEmoji=val;initBg();}
function updateOP(){document.querySelectorAll('.onboard-pip').forEach((p,i)=>{p.className='onboard-pip'+(i<currentStep?' done':i===currentStep?' current':'');});document.getElementById('onboardEyebrow').textContent=`Step ${currentStep+1} of ${onboardSteps.length}`;}

function nextStep(){
  const s=onboardSteps[currentStep];
  if(s.type==='input'){const val=document.getElementById('ob-'+s.key)?.value.trim();if(!val){alert('Please fill this in.');return;}onboardAnswers[s.key]=val;}
  else if(s.type==='single'){if(!onboardAnswers[s.key]){alert('Please make a selection.');return;}}
  else if(s.type==='tasks')saveOT();
  else if(s.type==='movement')prefs.movementTypes=tempMovement;
  else if(s.type==='bgpick')if(!onboardAnswers.bgEmoji)onboardAnswers.bgEmoji='none';
  if(currentStep===onboardSteps.length-1){finishOnboarding();return;}
  document.getElementById('step-'+currentStep).classList.remove('active');currentStep++;document.getElementById('step-'+currentStep).classList.add('active');document.getElementById('onboardBack').style.display='block';updateOP();window.scrollTo(0,0);
}
function prevStep(){if(currentStep===0)return;document.getElementById('step-'+currentStep).classList.remove('active');currentStep--;document.getElementById('step-'+currentStep).classList.add('active');if(currentStep===0)document.getElementById('onboardBack').style.display='none';updateOP();}
async function finishOnboarding(){
  prefs={...prefs,...onboardAnswers};
  prefs.profanity=onboardAnswers.profanity==='Yes';
  prefs.smokes=(onboardAnswers.smokes||'Neither').split(' — ')[0];
  prefs.drinks=(onboardAnswers.drinks||'No').split(' — ')[0];
  prefs.fitnessLevel=(onboardAnswers.fitnessLevel||'Intermediate').split(' — ')[0].toLowerCase();
  prefs.onboarding_complete=true;bgEmoji=prefs.bgEmoji||'none';
  await savePrefs();
  document.getElementById('onboardScreen').classList.remove('show');
  showMainApp();
}

// ── MAIN APP ──────────────────────────────────────────────
function showMainApp(){
  const isMaster=currentUser?.email===MASTER_EMAIL;
  userRole=isMaster?'master':(localStorage.getItem('fs_role')||selectedRole);
  viewMode=isMaster?'master':userRole;
  document.getElementById('mainApp').classList.add('show');
  const isTrainer=userRole==='trainer'||isMaster;
  const rs=document.getElementById('roleSwitcher');
  if(isTrainer){rs.style.display='flex';document.getElementById('rsMaster').style.display=isMaster?'block':'none';}
  else rs.style.display='none';
  const cogBtn=document.getElementById('cogBtn');if(cogBtn)cogBtn.style.display='block';
  updateAvatar();renderColorPicker();renderDefaultTabPicker();
  initApp();
  goTab(prefs.defaultTab||'home');
  if(isMaster)renderMasterStats();
}

function updateAvatar(){
  const btn=document.getElementById('avatarBtn');
  const profAvatar=document.getElementById('profileAvatar');
  const nameEl=document.getElementById('profileName');
  const isMaster=currentUser?.email===MASTER_EMAIL;
  const name=isMaster?'Xavier Ellis':(currentUser?.user_metadata?.first_name||prefs.name||currentUser?.email?.split('@')[0]||'X');
  const initials=name.substring(0,1).toUpperCase();
  if(btn)btn.textContent=initials;
  if(profAvatar)profAvatar.textContent=initials;
  if(nameEl)nameEl.textContent=name;
  const badge=document.getElementById('profileRoleBadge');
  const labels={master:'Master',trainer:'Trainer',client:'Client',member:'Member'};
  const classes={master:'role-master',trainer:'role-trainer',client:'role-client',member:'role-member'};
  if(badge){badge.textContent=labels[viewMode]||'Member';badge.className='profile-role-badge '+(classes[viewMode]||'role-member');}
}

function renderColorPicker(){const el=document.getElementById('colorPicker');if(!el)return;el.innerHTML=ACCENT_COLORS.map(c=>`<div class="c-swatch ${prefs.accentColor===c?'on':''}" style="background:${c};" onclick="setAccent('${c}',this)"></div>`).join('');}
function setAccent(color,el){prefs.accentColor=color;document.documentElement.style.setProperty('--accent',color);localStorage.setItem('fs_prefs',JSON.stringify(prefs));document.querySelectorAll('.c-swatch').forEach(s=>s.classList.remove('on'));el.classList.add('on');}
function renderDefaultTabPicker(){const el=document.getElementById('defaultTabPicker');if(!el)return;const tabs=[['home','🏠 Home'],['program','💪 Program'],['nutrition','🥗 Nutrition'],['coach','💬 Coach']];el.innerHTML=tabs.map(([id,lbl])=>`<button class="tp-btn ${prefs.defaultTab===id?'on':''}" onclick="setDefaultTab('${id}',this)">${lbl}</button>`).join('');}
function setDefaultTab(tab,el){prefs.defaultTab=tab;localStorage.setItem('fs_prefs',JSON.stringify(prefs));document.querySelectorAll('.tp-btn').forEach(b=>b.classList.remove('on'));el.classList.add('on');}
function setDensity(d,el){prefs.density=d;localStorage.setItem('fs_prefs',JSON.stringify(prefs));document.querySelectorAll('#densityCompact,#densityComfy').forEach(b=>b.classList.remove('on'));el.classList.add('on');}
function toggleMetric(){prefs.metric=prefs.metric==='us'?'metric':'us';const el=document.getElementById('metricDisplay');if(el)el.textContent=prefs.metric==='us'?'US — lbs / ft':'Metric — kg / cm';localStorage.setItem('fs_prefs',JSON.stringify(prefs));}
function toggleProfanity(el){el.classList.toggle('on');prefs.profanity=el.classList.contains('on');localStorage.setItem('fs_prefs',JSON.stringify(prefs));}

// ── INIT APP ──────────────────────────────────────────────
function initApp(){
  const now=new Date();
  document.getElementById('dateDisplay').textContent=now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.getElementById('quoteDisplay').textContent=operatorQuotes[now.getDay()%operatorQuotes.length];
  document.getElementById('streakBadge').textContent='🔥 '+state.streak+' day streak';
  document.getElementById('dayCount').textContent=state.dayCount;
  document.getElementById('soberDays').textContent=state.soberDays;
  document.getElementById('gymDays').textContent=state.gymDays;
  document.getElementById('bizStreak').textContent=state.streak;
  document.getElementById('gymStreak').textContent=state.gymStreak;
  document.getElementById('soberStreak').textContent=state.soberStreak;
  if(prefs.name)document.getElementById('appTitleEl').textContent=prefs.name+"'s Flowstate";
  const maxDays=parseInt(prefs.goalLength)||90;
  document.getElementById('daySubLabel').textContent='of '+maxDays;
  document.getElementById('streakGridTitle').textContent=maxDays+'-day streak';
  buildTaskList();buildBodySection();buildMindSection();buildTierList();
  buildGrid();updateProgress();startQuoteRotation();initChart();updateTiers();updateAccentColor();initBg();
  renderExercises();renderMeals();
  document.getElementById('toneDisplay').textContent=prefs.tone||'Brutal';
  setTimeout(()=>restoreTodayState(),100);
}

// ── DYNAMIC SECTIONS ──────────────────────────────────────
function buildTaskList(){
  const tasks=prefs.tasks||[];
  document.getElementById('taskList').innerHTML=tasks.length?tasks.map((t,i)=>`<div class="task-row" style="${i===tasks.length-1?'border-bottom:none;padding-bottom:0;':''}"><div class="task-check" id="chk-${t.id}" onclick="toggleCheck('${t.id}','done')"></div><div class="task-label" id="lbl-${t.id}">${t.label}</div><span class="task-badge badge-${t.category==='biz'?'biz':'custom'}">${t.category==='biz'?'biz':'custom'}</span>${t.target?`<input class="task-input" id="inp-${t.id}" type="number" min="0" max="999" placeholder="0" oninput="updateProgress()"/><div class="task-target">/ ${t.target}</div>`:''}</div>`).join(''):`<div style="font-size:13px;color:var(--text2);padding:8px 0;">No tasks set — open settings ⚙️ to add them.</div>`;
  updateProgress();
}
function buildBodySection(){
  document.getElementById('bodyTaskList').innerHTML=(prefs.bodyTasks||[]).map((t,i)=>`<div class="task-row" style="${i===(prefs.bodyTasks.length-1)?'border-bottom:none;padding-bottom:0;':''}"><div class="task-check" id="chk-${t.id}" onclick="toggleCheck('${t.id}','gym-done')"></div><div class="task-label" id="lbl-${t.id}">${t.label}</div><span class="task-badge badge-body">body</span></div>`).join('');
  document.getElementById('gymTypeRow').innerHTML=(prefs.movementTypes||[]).map(m=>`<button class="gym-btn" onclick="selectGym(this,'${m}')">${m}</button>`).join('');
}
function buildMindSection(){
  const hasSober=hasSoberTracking();
  const title=document.getElementById('mindSectionTitle');
  const content=document.getElementById('mindContent');
  const note=document.getElementById('soberNote');
  document.getElementById('soberMetricLabel').textContent=hasSober?'Sober':'Habits';
  document.getElementById('soberStreakLabel').textContent=hasSober?'Sobriety':'Habits';
  document.getElementById('mindNotifLabel').textContent=hasSober?'Sobriety check-in':'Habit check-in';
  state.soberItems={};
  if(hasSober){
    title.textContent='Mind — sobriety';
    const items=getSoberItems();
    items.forEach(item=>{state.soberItems[item.id]=false;});
    content.innerHTML=`<div class="sober-checks">${items.map(item=>`<div class="sober-item" id="sober-${item.id}" onclick="toggleSoberItem('${item.id}')"><span style="font-size:20px;">${item.emoji}</span><div><div class="sober-item-text">${item.label}</div><div class="sober-item-sub">tap to confirm</div></div></div>`).join('')}</div>`;
    note.textContent='Your body is infrastructure. Protect it like capital.';
  }else{
    title.textContent='Mind — habits';
    const habits=prefs.customHabits||[];
    if(!habits.length){content.innerHTML=`<div style="font-size:13px;color:var(--text2);">Add habits in settings ⚙️ to track them here.</div>`;note.textContent='';}
    else{habits.forEach((_,i)=>{state.soberItems['habit_'+i]=false;});content.innerHTML=`<div>${habits.map((h,i)=>`<div class="custom-habit-row"><div class="task-check" id="sober-habit_${i}" onclick="toggleSoberItem('habit_${i}')"></div><div style="font-size:14px;color:var(--text);flex:1;">${h}</div><span class="task-badge badge-custom">habit</span></div>`).join('')}</div>`;note.textContent='Small wins compound. Lock these in daily.';}
  }
}
function buildTierList(){document.getElementById('tierList').innerHTML=(prefs.tiers||[]).map((t,i)=>`<div class="tier-row"><div class="tier-dot" style="background:${t.color||'#888'};"></div><div class="tier-info"><div class="tier-name">${t.name} — ${t.days} days</div><div class="tier-desc">${t.desc}</div><div class="tier-reward">${t.reward}</div></div><div class="tier-status locked" id="tier${i}Status">Locked</div></div>`).join('');}
function updateTiers(){(prefs.tiers||[]).forEach((t,i)=>{const el=document.getElementById('tier'+i+'Status');if(!el)return;const u=state.streak>=t.days;el.textContent=u?'Unlocked':'Locked';el.className='tier-status '+(u?'unlocked':'locked');});}

function getName(){return prefs.name||'You';}
function getMotivator(){return prefs.motivator||'the people who matter to you';}
function getGoal(){return prefs.goal||'your goals';}
function getFears(){return prefs.fears||'staying exactly where you are';}
function getFitnessLevel(){return(prefs.fitnessLevel||'intermediate').toLowerCase();}
function smokes(){return prefs.smokes&&prefs.smokes!=='Neither'&&!String(prefs.smokes).includes('Neither');}
function drinks(){return prefs.drinks&&prefs.drinks!=='No'&&!String(prefs.drinks).includes('No');}
function hasSoberTracking(){return smokes()||drinks();}
function getSoberItems(){const items=[];if(drinks())items.push({id:'noAlcohol',emoji:'🚫',label:'No alcohol'});if(prefs.smokes==='Cigarettes'||prefs.smokes==='Both')items.push({id:'noCigs',emoji:'🚭',label:'No cigarettes'});if(prefs.smokes==='Weed'||prefs.smokes==='Both')items.push({id:'noWeed',emoji:'🌿',label:'No weed'});return items;}

function getExpandedConsequence(){
  const n=getName(),m=getMotivator(),g=getGoal(),f=getFears(),p=prefs.profanity;
  const fitness=getFitnessLevel();
  const isBeg=fitness==='beginner',isAdv=fitness==='advanced';
  const physLight=isBeg?'10 push-ups before bed.':isAdv?'50 push-ups and a cold plunge.':'25 push-ups before bed.';
  const physMed=isBeg?'20 push-ups + 10 squats before you sleep.':isAdv?'100 push-ups + 50 burpees tonight.':'50 push-ups before you sleep.';
  const physTough=isBeg?'30 push-ups + 20 squats + 10 burpees.':isAdv?'150 push-ups + 75 burpees + 1 mile run.':'100 push-ups + 50 burpees tonight.';
  const wakeLight=isBeg?'5:45am tomorrow.':isAdv?'4:45am cold shower.':'5:30am. No snooze.';
  const wakeTough=isBeg?'5:30am. Review your goals first.':isAdv?'4:30am. Train before anything.':'5:00am. Work before coffee.';
  const all=[
    {tier:'Light',tierClass:'light',level:'Hard',text:'No entertainment tonight. No shows, no scrolling.',action:'Review your goals before you sleep.'},
    {tier:'Light',tierClass:'light',level:'Hard',text:`Wake up ${wakeLight}`,action:'Set the alarm now.'},
    {tier:'Light',tierClass:'light',level:'Hard',text:'Cold shower before bed.',action:'Do it now.'},
    {tier:'Light',tierClass:'light',level:'Hard',text:'Write your top 3 goals out by hand.',action:'Not typed. Written. 5 minutes.'},
    {tier:'Light',tierClass:'light',level:'Hard',text:physLight,action:'Complete it before you sleep.'},
    {tier:'Medium',tierClass:'medium',level:'Brutal',text:`${physMed} ${p?'Get off your ass.':''}`,action:'Before you close this app.'},
    {tier:'Medium',tierClass:'medium',level:'Brutal',text:'Double your task targets tomorrow.',action:'Screenshot this.'},
    {tier:'Medium',tierClass:'medium',level:'Brutal',text:'No spending on anything non-essential for 48 hours.',action:'You forfeited that right.'},
    {tier:'Medium',tierClass:'medium',level:'Brutal',text:`Text ${m} right now and tell them you didn't execute today.`,action:'Do it.'},
    {tier:'Medium',tierClass:'medium',level:'Brutal',text:`The version of ${n} that wins is built one day at a time. Today you skipped a brick.`,action:'Tomorrow you lay two.'},
    {tier:'Tough',tierClass:'tough',level:'Brutal',text:`${physTough} ${p?'No excuses, no bullshit.':'Zero exceptions.'}`,action:'Do it now.'},
    {tier:'Tough',tierClass:'tough',level:'Brutal',text:`Your fear is ${f}. Today you chose to stay closer to it.`,action:'Write it out before you sleep.'},
    {tier:'Tough',tierClass:'tough',level:'Brutal',text:`Nobody is coming to save you. Just you. And today you weren't enough.`,action:'Tomorrow you execute without excuses.'},
    {tier:'Tough',tierClass:'tough',level:'Brutal',text:`You can feel bad about this or you can do something about it.`,action:'Pick one task right now. Partial beats zero.'},
  ];
  return all[Math.floor(Math.random()*all.length)];
}
function getSoberConsequences(){const g=getGoal();return[{text:`Sobriety streak reset. Everything you want is built on who you are every single day.`,action:"Sobriety restarts tomorrow."},{text:`The version of you building ${g} doesn't cloud their mind. You know this.`,action:"Sober streak resets."},{text:`Clean and clear builds different. Today was a data point. Tomorrow is a choice.`,action:"Show up clean tomorrow."}];}

let quoteIndex=0;
function startQuoteRotation(){quoteIndex=Math.floor(Math.random()*universalQuotes.length);showQuote();setInterval(()=>{quoteIndex=(quoteIndex+1)%universalQuotes.length;showQuote();},8000);}
function showQuote(){const q=universalQuotes[quoteIndex];document.getElementById('rotatingQuote').textContent='"'+q.text+'"';document.getElementById('rotatingAuthor').textContent='— '+q.author;}

function initChart(){
  const ctx=document.getElementById('progressChart').getContext('2d');
  const data=chartData.streak.length?chartData.streak:Array(14).fill(0);
  if(chartInstance)chartInstance.destroy();
  chartInstance=new Chart(ctx,{type:'line',data:{labels:Array.from({length:14},(_,i)=>'D'+(i+1)),datasets:[{data,borderColor:'#1D9E75',backgroundColor:'rgba(29,158,117,0.08)',borderWidth:2,pointBackgroundColor:'#1D9E75',pointRadius:3,tension:0.4,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#444',font:{size:10}}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#444',font:{size:10}},beginAtZero:true}}}});
}
function switchChart(type,btn){
  document.querySelectorAll('.chart-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  let data,color,bg;
  if(type==='streak'){data=chartData.streak.length?chartData.streak:Array(14).fill(0);color='#1D9E75';bg='rgba(29,158,117,0.08)';}
  else if(type==='tasks'){data=chartData.tasks.length?chartData.tasks:Array(14).fill(0);color='#7F77DD';bg='rgba(127,119,221,0.08)';}
  else{data=chartData.wins.length?chartData.wins:Array(14).fill(0);color='#FAC775';bg='rgba(250,199,117,0.08)';}
  if(chartInstance)chartInstance.destroy();
  chartInstance=new Chart(document.getElementById('progressChart').getContext('2d'),{type:'bar',data:{labels:Array.from({length:14},(_,i)=>'D'+(i+1)),datasets:[{data,backgroundColor:bg,borderColor:color,borderWidth:1.5,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#444',font:{size:10}}},y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#444',font:{size:10}},beginAtZero:true}}}});
}
function buildGrid(){
  const n=parseInt(prefs.goalLength)||90;
  const g=document.getElementById('streakGrid');g.innerHTML='';
  const entryMap={};journalData.forEach(e=>{entryMap[e.log_date]=e;});
  const startDate=new Date();startDate.setDate(startDate.getDate()-state.dayCount+1);
  for(let i=0;i<n;i++){
    const d=document.createElement('div');
    const dateStr=new Date(startDate.getTime()+i*86400000).toISOString().split('T')[0];
    const entry=entryMap[dateStr];
    let cls='sdot';
    if(entry){cls+=entry.is_win?' filled':' filled-miss';}else if(i===state.dayCount-1)cls+=' today';
    d.className=cls;d.title=dateStr;d.onclick=()=>openJournalEntry(dateStr);g.appendChild(d);
  }
}

async function loadJournalData(){if(!currentUser)return;try{const{data}=await sb.from('daily_logs').select('*').eq('user_id',currentUser.id).order('log_date',{ascending:false});if(data)journalData=data;}catch(e){}}
async function openJournal(){await loadJournalData();calViewDate=new Date();document.getElementById('journalModal').classList.add('show');renderCalendar();renderJournal();}
function closeJournal(){document.getElementById('journalModal').classList.remove('show');}
async function openJournalEntry(dateStr){await loadJournalData();calViewDate=new Date(dateStr+'T12:00:00');document.getElementById('journalModal').classList.add('show');renderCalendar(dateStr);const entry=journalData.find(e=>e.log_date===dateStr);document.getElementById('journalEntries').innerHTML=entry?buildEntryCard(entry):`<div class="no-entries">No entry for this date yet.</div>`;}
function changeMonth(dir){calViewDate=new Date(calViewDate.getFullYear(),calViewDate.getMonth()+dir,1);renderCalendar();}
function renderCalendar(selectedDate=''){
  const y=calViewDate.getFullYear(),m=calViewDate.getMonth();
  document.getElementById('calMonthLabel').textContent=new Date(y,m,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const firstDay=new Date(y,m,1).getDay(),daysInMonth=new Date(y,m+1,0).getDate();
  const today=new Date().toISOString().split('T')[0];
  const entryMap={};journalData.forEach(e=>{entryMap[e.log_date]=e;});
  let html='';
  for(let i=0;i<firstDay;i++)html+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const entry=entryMap[ds];
    let cls='cal-day';
    if(entry)cls+=entry.is_win?' has-win':' has-miss';
    if(ds===today)cls+=' today';
    if(ds===selectedDate)cls+=' selected';
    html+=`<div class="${cls}" onclick="showDayEntry('${ds}')">${d}</div>`;
  }
  document.getElementById('calGrid').innerHTML=html;
}
function showDayEntry(dateStr){
  document.querySelectorAll('.cal-day').forEach(d=>d.classList.remove('selected'));
  event.target.classList.add('selected');
  const entry=journalData.find(e=>e.log_date===dateStr);
  const el=document.getElementById('journalEntries');
  el.innerHTML=entry?buildEntryCard(entry):`<div class="no-entries">No entry for this date.</div>`;
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderJournal(){
  const search=document.getElementById('journalSearch')?.value.toLowerCase()||'';
  const filtered=journalData.filter(e=>!search||[e.log_date,e.mood,e.focus_word,e.journal_win1,e.journal_win2,e.journal_miss1,e.journal_miss2].join(' ').toLowerCase().includes(search));
  const el=document.getElementById('journalEntries');
  el.innerHTML=filtered.length?filtered.map(e=>buildEntryCard(e)).join(''):`<div class="no-entries">No entries found.</div>`;
}
function buildEntryCard(e){
  const date=new Date(e.log_date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  let html=`<div class="entry-card"><div class="entry-top"><div class="entry-date-label">${date}</div><div class="entry-badge ${e.is_win?'win':'miss'}">${e.is_win?'✓ Won':'✗ Fell short'}</div></div>`;
  if(e.biz_streak||e.gym_streak||e.sober_streak)html+=`<div class="entry-streaks">🔥 ${e.biz_streak||0} biz · 💪 ${e.gym_streak||0} gym · 🧠 ${e.sober_streak||0} sober</div>`;
  if(e.focus_word)html+=`<div class="entry-q">Energy word</div><div class="entry-a">${e.focus_word}</div>`;
  if(e.is_win){if(e.journal_win1)html+=`<div class="entry-q">Biggest win</div><div class="entry-a">${e.journal_win1}</div>`;if(e.journal_win2)html+=`<div class="entry-q">Momentum into tomorrow</div><div class="entry-a">${e.journal_win2}</div>`;}
  else{if(e.journal_miss1)html+=`<div class="entry-q">What got in the way</div><div class="entry-a">${e.journal_miss1}</div>`;if(e.journal_miss2)html+=`<div class="entry-q">What changes tomorrow</div><div class="entry-a">${e.journal_miss2}</div>`;}
  html+=`</div>`;return html;
}

function selectMood(btn){document.querySelectorAll('#moodRow .mood-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');saveTodayState();}
function selectGym(btn,val){
  document.querySelectorAll('#gymTypeRow .gym-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');state.gymType=val;
  if(val!=='Rest day'){const chk=document.getElementById('chk-gym');const lbl=document.getElementById('lbl-gym');if(chk)chk.className='task-check gym-done';if(lbl)lbl.classList.add('done-text');}
  updateProgress();saveTodayState();
}
function toggleSoberItem(id){const el=document.getElementById('sober-'+id);if(!el)return;el.classList.toggle('clean');state.soberItems[id]=el.classList.contains('clean');saveTodayState();}
function isFullySober(){const items=Object.values(state.soberItems);if(!items.length)return true;return items.every(v=>v===true);}

function selectResult(type){
  document.getElementById('winBtn').className='debrief-btn'+(type==='win'?' win-selected':'');
  document.getElementById('missBtn').className='debrief-btn'+(type==='miss'?' miss-selected':'');
  state.selectedResult=type;
  document.getElementById('debriefSection').style.display='block';
  document.getElementById('winDebrief').style.display=type==='win'?'block':'none';
  document.getElementById('missDebrief').style.display=type==='miss'?'block':'none';
  if(type==='miss'){
    const c=getExpandedConsequence();
    document.getElementById('conTier').textContent=c.tier;document.getElementById('conTier').className='con-tier '+c.tierClass;
    document.getElementById('conLevel').textContent=c.level;document.getElementById('conLevel').className='con-level '+(c.level==='Brutal'?'con-brutal':'con-hard');
    document.getElementById('conText').textContent=c.text;document.getElementById('conAction').textContent=c.action;
    document.getElementById('consequenceBox').style.display='block';
  }else document.getElementById('consequenceBox').style.display='none';
  const btn=document.getElementById('submitBtn');
  if(type==='win'){btn.classList.add('ready');btn.style.background='var(--accent)';btn.textContent='I won today 🔥';}
  else{btn.classList.remove('ready');btn.style.background='var(--red)';btn.textContent='I failed today';}
  saveTodayState();
}

function toggleCheck(id,cls){
  const chk=document.getElementById('chk-'+id);const lbl=document.getElementById('lbl-'+id);if(!chk)return;
  const isDone=chk.classList.contains(cls)||chk.classList.contains('done');
  chk.className='task-check'+(isDone?'':' '+cls);
  if(lbl)lbl.classList.toggle('done-text',!isDone);
  updateProgress();saveTodayState();
}

function updateProgress(){
  const tasks=prefs.tasks||[];let done=0;
  tasks.forEach(t=>{const chk=document.getElementById('chk-'+t.id);const inp=document.getElementById('inp-'+t.id);if(!chk)return;let completed=chk.classList.contains('done')||chk.classList.contains('gym-done');if(inp&&t.target){const val=parseInt(inp.value)||0;if(val>=t.target){chk.className='task-check done';const l=document.getElementById('lbl-'+t.id);if(l)l.classList.add('done-text');completed=true;}}if(completed)done++;});
  const total=tasks.length||1,pct=Math.round((done/total)*100);
  document.getElementById('progressBar').style.width=pct+'%';
  document.getElementById('progressLabel').textContent=done+' of '+total+' tasks complete';
  document.getElementById('completedPct').textContent=pct+'%';
  const allDone=done===total&&total>0;
  const banner=document.getElementById('allDoneBanner');
  if(allDone){banner.style.display='block';if(!allTasksDoneFired){allTasksDoneFired=true;launchFireworks();}}
  else{banner.style.display='none';allTasksDoneFired=false;}
  if(!state.selectedResult){
    const btn=document.getElementById('submitBtn');
    if(allDone){btn.classList.add('ready');btn.style.background='var(--accent)';btn.textContent=state.streak>0?`Win — day ${state.streak+1} locked in`:'Lock in day 1';}
    else{btn.classList.remove('ready');btn.style.background='var(--red)';btn.textContent='I failed today';}
  }
}

async function submitDay(){
  if(!state.selectedResult){alert('Please complete your end of day debrief first.');return;}
  if(state.selectedResult==='win'){const w1=document.getElementById('winQ1')?.value.trim(),w2=document.getElementById('winQ2')?.value.trim();if(!w1||!w2){alert('Please complete both win debrief fields.');return;}state.journalWin1=w1;state.journalWin2=w2;}
  if(state.selectedResult==='miss'){const m1=document.getElementById('missQ1')?.value.trim(),m2=document.getElementById('missQ2')?.value.trim();if(!m1||!m2){alert('Please complete both miss debrief fields.');return;}state.journalMiss1=m1;state.journalMiss2=m2;}
  const tasks=prefs.tasks||[];let done=0;tasks.forEach(t=>{const chk=document.getElementById('chk-'+t.id);if(chk&&(chk.classList.contains('done')||chk.classList.contains('gym-done')))done++;});
  const pct=tasks.length?Math.round((done/tasks.length)*100):0;
  const isWin=state.selectedResult==='win'||pct>=80;
  const gymDone=document.getElementById('chk-gym')?.classList.contains('gym-done')||document.getElementById('chk-gym')?.classList.contains('done');
  const fullySober=isFullySober();
  if(isWin)state.streak=(state.streak||0)+1;else state.streak=0;
  if(gymDone){state.gymStreak=(state.gymStreak||0)+1;state.gymDays=(state.gymDays||0)+1;}else state.gymStreak=0;
  if(fullySober){state.soberStreak=(state.soberStreak||0)+1;state.soberDays=(state.soberDays||0)+1;}else state.soberStreak=0;
  const maxDays=parseInt(prefs.goalLength)||90;state.dayCount=Math.min((state.dayCount||1)+1,maxDays);
  updateTiers();buildGrid();updateAccentColor();
  document.getElementById('streakBadge').textContent='🔥 '+state.streak+' day streak';
  document.getElementById('soberDays').textContent=state.soberDays;document.getElementById('gymDays').textContent=state.gymDays;
  document.getElementById('bizStreak').textContent=state.streak;document.getElementById('gymStreak').textContent=state.gymStreak;
  document.getElementById('soberStreak').textContent=state.soberStreak;document.getElementById('dayCount').textContent=state.dayCount;
  await saveToDB({streak:state.streak,gymStreak:state.gymStreak,soberStreak:state.soberStreak,soberDays:state.soberDays,gymDays:state.gymDays,dayCount:state.dayCount,isWin,fullySober,gymDone});
  resetDayState();allTasksDoneFired=false;
  const sobC=getSoberConsequences();const bc=getExpandedConsequence();
  const card=document.getElementById('overlayCard'),ovAction=document.getElementById('ovAction'),ovClose=document.getElementById('ovClose');
  const topTier=prefs.tiers?.length?prefs.tiers[prefs.tiers.length-1]:null;const newTier=prefs.tiers?.find(t=>t.days===state.streak);
  if(!fullySober&&!isWin){const sc=sobC[0];card.className='overlay-card brutal';document.getElementById('ovIcon').textContent='💀';document.getElementById('ovTitle').textContent='Miss across the board.';document.getElementById('ovText').textContent=bc.text+'\n\n'+sc.text;ovAction.textContent=bc.action;ovAction.style.display='block';ovClose.textContent='I understand. Tomorrow I execute.';}
  else if(!fullySober&&hasSoberTracking()){const sc=sobC[0];card.className='overlay-card sober';document.getElementById('ovIcon').textContent='🔄';document.getElementById('ovTitle').textContent='Sobriety streak reset.';document.getElementById('ovText').textContent=sc.text;ovAction.textContent=sc.action;ovAction.style.display='block';ovClose.textContent='Restart tomorrow.';}
  else if(!isWin){card.className='overlay-card brutal';document.getElementById('ovIcon').textContent='🔴';document.getElementById('ovTitle').textContent=bc.level==='Brutal'?'No sugar coating.':'Miss logged.';document.getElementById('ovText').textContent=bc.text;ovAction.textContent=bc.action;ovAction.style.display='block';ovClose.textContent='I fell short. Tomorrow I execute.';}
  else if(topTier&&state.streak>=topTier.days&&state.streak===topTier.days){card.className='overlay-card crown';document.getElementById('ovIcon').textContent='👑';document.getElementById('ovTitle').textContent='You built the machine.';document.getElementById('ovText').textContent=`${getName()}, you did it.\n\nBusiness. Body. Mind. All locked