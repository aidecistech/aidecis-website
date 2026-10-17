(() => {
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const menu=document.querySelector('.menu-toggle'),nav=document.getElementById('primary-nav');
 if(menu&&nav){menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open)});nav.addEventListener('click',e=>{if(!e.target.closest('a'))return;menu.setAttribute('aria-expanded','false');nav.classList.remove('is-open')});document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav.classList.remove('is-open');menu.setAttribute('aria-expanded','false')}})}
 const film=document.getElementById('world-film'),toggle=document.getElementById('film-toggle');
 if(film&&toggle){
  let userPaused=false;
  const messages=[...document.querySelectorAll('[data-film-stage]')];
  const story=()=>{const stage=reduced.matches?2:film.currentTime<6?0:film.currentTime<10?1:2;messages.forEach((el,i)=>el.classList.toggle('is-active',i===stage));};
  const label=()=>{toggle.textContent=window.AidecisI18n?.t(film.paused?'Play film':'Pause film')||(film.paused?'Play film':'Pause film');toggle.setAttribute('aria-pressed',String(film.paused));};
  const play=()=>film.play().catch(()=>{messages.forEach((el,i)=>el.classList.toggle('is-active',i===2));label();});
  if(reduced.matches){film.pause();userPaused=true;}
  toggle.addEventListener('click',()=>{if(film.paused){userPaused=false;play();}else{userPaused=true;film.pause();}label();});
  film.addEventListener('timeupdate',()=>{story();const el=document.querySelector('.film-index');const scenes=['FIELDS & FARMING','MANUFACTURING SITES','PRODUCTION','ROAD TRANSPORT','SHIPPING','PORT OPERATIONS'];const i=Math.min(5,Math.max(0,Math.floor(film.currentTime/4)));if(el)el.textContent=String(i+1).padStart(2,'0')+' / 06 — '+(window.AidecisI18n?.t(scenes[i])||scenes[i]);});
  film.addEventListener('play',label);film.addEventListener('pause',label);
  film.addEventListener('error',()=>{messages.forEach((el,i)=>el.classList.toggle('is-active',i===2));toggle.hidden=true;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)film.pause();else if(!userPaused&&!reduced.matches)play();});
  label();story();if(!reduced.matches)play();
  document.addEventListener('aidecis:languagechange',()=>{label();film.dispatchEvent(new Event('timeupdate'));});
 }
 const portal=document.querySelector('.portal-section'),ring=document.querySelector('.portal-ring');let scheduled=false;
 function paint(){scheduled=false;if(!portal||!ring||reduced.matches)return;const rect=portal.getBoundingClientRect(),top=window.innerWidth<=860?78:92,range=Math.max(1,rect.height-(window.innerHeight-top)),p=Math.min(1,Math.max(0,(top-rect.top)/range));const open=p<.3?p/.3:p<.8?1:(1-p)/.2;ring.style.transform='scale('+(0.7+2*Math.max(0,open))+')';const reveal=portal.querySelector('.portal-reveal'),caption=portal.querySelector('.portal-caption');if(reveal){reveal.style.clipPath='circle('+(Math.max(0,open)*150)+'vmax at 50% 50%)';reveal.style.visibility=p>.04?'visible':'hidden';reveal.inert=p<.25||p>.95;}if(caption)caption.style.opacity=String(Math.max(0,1-p/.15));}
 if(portal){window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(paint)}},{passive:true});window.addEventListener('resize',paint);paint()}
 document.querySelectorAll('.industry-dropdown').forEach(d=>{d.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')d.open=true});d.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!d.contains(document.activeElement))d.open=false});d.addEventListener('focusout',()=>{setTimeout(()=>{if(!d.contains(document.activeElement)&&!d.matches(':hover'))d.open=false},0)});d.addEventListener('keydown',e=>{if(e.key==='Escape'){d.open=false;d.querySelector('summary').focus()}})});
})();
