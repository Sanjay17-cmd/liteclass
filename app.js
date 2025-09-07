import { supabase } from './index.html';

let manifest=null, slides=[], audioURL=null, currentSlide=0, syncTimer=null;

const zipInput=document.getElementById('zipInput'),
      loadStatus=document.getElementById('loadStatus'),
      audio=document.getElementById('player'),
      slideImg=document.getElementById('slide'),
      prevBtn=document.getElementById('prevBtn'),
      nextBtn=document.getElementById('nextBtn'),
      startBtn=document.getElementById('startBtn'),
      resetBtn=document.getElementById('resetBtn'),
      lessonList=document.getElementById('lessonList');

// load from file input
zipInput.addEventListener('change', async e => {
  const f=e.target.files[0]; if(!f) return;
  loadStatus.textContent='Loading...';
  try {
    const zip=await JSZip.loadAsync(f);
    manifest=JSON.parse(await zip.file('manifest.json').async('string'));
    const audioFile=zip.file(manifest.audio);
    if(!audioFile) return loadStatus.textContent='Audio missing';
    const audioBlob=await audioFile.async('blob');
    if(audioURL) URL.revokeObjectURL(audioURL);
    audioURL=URL.createObjectURL(audioBlob); audio.src=audioURL;

    slides=[];
    for(const s of manifest.slides){
      const fe=zip.file(s.file); if(!fe) continue;
      const b=await fe.async('blob'); slides.push({url:URL.createObjectURL(b),at:+s.at||0});
    }
    slides.sort((a,b)=>a.at-b.at);
    currentSlide=0; slideImg.src=slides[0]?.url||'';
    loadStatus.textContent=`Loaded ${manifest.title} (${slides.length} slides)`;
  } catch(err) { console.error(err); loadStatus.textContent='ZIP error'; }
});

function showSlide(i){ if(!slides.length) return; currentSlide=Math.max(0,Math.min(i,slides.length-1)); slideImg.src=slides[currentSlide].url; }
prevBtn.onclick=()=>showSlide(currentSlide-1);
nextBtn.onclick=()=>showSlide(currentSlide+1);

function startSync(){
  if(!slides.length) return; if(syncTimer) clearInterval(syncTimer);
  syncTimer=setInterval(()=>{
    const t=Math.floor(audio.currentTime||0); let idx=0;
    for(let i=0;i<slides.length;i++){ if(slides[i].at<=t) idx=i; else break; }
    if(idx!==currentSlide) showSlide(idx);
  },500);
}

startBtn.onclick=()=>{ if(!slides.length) return alert("Load a lesson"); audio.play(); startSync(); };
resetBtn.onclick=()=>{ if(syncTimer) clearInterval(syncTimer); audio.pause(); audio.currentTime=0; showSlide(0); };

window.addEventListener('beforeunload',()=>{ if(audioURL) URL.revokeObjectURL(audioURL); for(const s of slides) URL.revokeObjectURL(s.url); });

// list lessons from Supabase
async function loadLessons(){
  const { data, error } = await supabase.storage.from('lessons').list('', { limit:100 });
  if(error){ lessonList.innerHTML="<li>Failed to load lessons</li>"; return; }
  lessonList.innerHTML='';
  data.forEach(file=>{
    const li=document.createElement('li');
    const btn=document.createElement('button');
    btn.textContent=file.name;
    btn.onclick=()=>downloadLesson(file.name);
    li.appendChild(btn); lessonList.appendChild(li);
  });
}
loadLessons();

// download lesson from Supabase
async function downloadLesson(fileName){
  loadStatus.textContent='Downloading...';
  const { data, error } = await supabase.storage.from('lessons').download(fileName);
  if(error){ loadStatus.textContent='Download failed'; console.error(error); return; }
  const file = new File([data], fileName);
  const dt = new DataTransfer();
  dt.items.add(file);
  zipInput.files = dt.files; 
  zipInput.dispatchEvent(new Event('change'));
}
