/* Local playback only. Original movie timing and attack controls remain inside the SWF. */
window.RufflePlayer=window.RufflePlayer||{};
window.RufflePlayer.config={
  autoplay:'on',unmuteOverlay:'hidden',splashScreen:false,
  letterbox:'on',scale:'showAll',forceScale:true,logLevel:'error',
  allowScriptAccess:false,allowNetworking:'none',openUrlMode:'deny',
  contextMenu:'off',showSwfDownload:false,publicPath:'assets/ruffle/'
};

const stage=document.querySelector('#stage');
const loading=document.querySelector('#loading');
const failure=document.querySelector('#failure');
const statusText=document.querySelector('#state');
let player=null,character=new URLSearchParams(location.search).get('character')==='dog'?'dog':'cat',paused=false,muted=false,loadSerial=0;
let lastFrame=594,lastContext=0,finaleFrame=0,loaded=false;
let loadAbort=null;
let loadDiagnostic={version:'mobile-load-2',phase:'准备游戏',error:null};
const names={cat:'猫咪',dog:'狗狗'};
const actionRanges=[[600,753,1],[754,838,2],[839,913,3],[914,1004,4],[1005,1168,5],[1169,1282,6],[1283,1397,7],[1398,1527,8],[1528,1664,9],[1665,1801,10],[1928,2778,11]];

function updateStatus(){
  let action=lastContext===641?11:(actionRanges.find(([a,b])=>lastFrame>=a&&lastFrame<=b)?.[2]);
  const title=action===11?'组合演出':action?`${action} 号动作`:'准备出招';
  statusText.textContent=`${names[character]} · ${paused?'已暂停':title}`;
  document.querySelector('#pause').textContent=paused?'继续':'暂停';
  document.querySelector('#pause').setAttribute('aria-pressed',String(paused));
  document.querySelector('#sound').textContent=muted?'开启声音':'静音';
  document.querySelector('#sound').setAttribute('aria-pressed',String(muted));
  document.body.classList.toggle('paused',paused);
}

async function openCharacter(next=character){
  const serial=++loadSerial;
  if(loadAbort)loadAbort.abort();
  const controller=new AbortController();loadAbort=controller;
  character=next;paused=false;loaded=false;lastFrame=594;lastContext=0;finaleFrame=0;
  loading.hidden=false;failure.hidden=true;
  document.querySelector('#load-details').hidden=true;
  loadDiagnostic={version:'mobile-load-2',phase:'准备游戏',error:null};
  for(const button of document.querySelectorAll('[data-character]')){
    button.setAttribute('aria-pressed',String(button.dataset.character===character));
    button.classList.toggle('selected',button.dataset.character===character);
  }
  statusText.textContent=`正在准备${names[character]}`;
  if(player){player.remove();player=null;}
  const observeFrame=message=>{
    const match=/PET_FRAME:(\d+):(\d+)/.exec(message);
    if(match&&serial===loadSerial&&(Number(match[1])===0||Number(match[1])===641)){
      lastContext=Number(match[1]);lastFrame=Number(match[2]);
      if(lastContext===641)finaleFrame=lastFrame;
      if(!loaded&&lastContext===0&&lastFrame>=594){loaded=true;loading.hidden=true;}
      updateStatus();
    }
  };
  const showStep=phase=>{
    if(serial!==loadSerial)return;
    loadDiagnostic.phase=phase;loading.textContent=phase+'…';
  };
  try{
    showStep(`正在下载${names[character]}游戏文件`);
    let movie;
    if(window.__petEmbeddedMovie)movie={data:window.__petEmbeddedMovie(character)};
    else{
      const response=await fetch(new URL(`assets/${character}.swf`,document.baseURI),{signal:controller.signal});
      if(!response.ok)throw new Error(`游戏文件下载失败（HTTP ${response.status}）`);
      const data=new Uint8Array(await response.arrayBuffer());
      if(serial!==loadSerial)return;
      const signature=String.fromCharCode(...data.subarray(0,3));
      if(!['FWS','CWS','ZWS'].includes(signature))throw new Error('下载内容不是有效的游戏文件');
      loadDiagnostic.movieBytes=data.byteLength;
      movie={data};
    }
    showStep('正在加载运行组件');
    if(typeof window.RufflePlayer.newest!=='function')throw new Error('运行组件下载未完成，请刷新页面重试');
    const nextPlayer=window.RufflePlayer.newest().createPlayer();
    nextPlayer.setAttribute('aria-label',`${names[character]}游戏，点击右侧数字按钮出招`);
    stage.replaceChildren(nextPlayer);player=nextPlayer;
    await nextPlayer.load({...movie,fontSources:[],parameters:{}});
    if(serial!==loadSerial)return;
    nextPlayer.traceObserver=observeFrame;
    nextPlayer.volume=muted?0:1;
    showStep('正在准备游戏画面');
    const deadline=Date.now()+45000;
    while(!loaded&&Date.now()<deadline&&serial===loadSerial){
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(serial!==loadSerial)return;
    if(!loaded&&nextPlayer.metadata){loaded=true;loading.hidden=true;}
    if(!loaded)throw new Error('游戏加载超时');
    loadDiagnostic.phase='已打开';
    updateStatus();
  }catch(error){
    if(serial!==loadSerial)return;
    loading.hidden=true;failure.hidden=false;
    const message=String(error?.message||error).slice(0,600);
    loadDiagnostic.error={name:error?.name||'Error',message};
    document.querySelector('#failure-message').textContent=`${loadDiagnostic.phase}失败。请点“重新打开”重试；仍失败可查看下方加载原因。`;
    const detail=document.querySelector('#load-details');
    detail.hidden=false;detail.open=true;
    document.querySelector('#load-diagnostic').textContent=[
      `版本：${loadDiagnostic.version}`,
      `阶段：${loadDiagnostic.phase}`,
      `错误：${loadDiagnostic.error.name}: ${message}`,
      `游戏文件：${loadDiagnostic.movieBytes??'未完成'} 字节`,
      `浏览器：${navigator.userAgent}`
    ].join('\n');
    statusText.textContent='尚未打开';
    console.error('Unable to open local movie',error);
  }
}

function togglePause(){
  if(!player||!loaded)return;
  paused=!paused;
  if(paused)player.pause();else player.play();
  updateStatus();
}
async function fullscreen(){
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else if(document.querySelector('.game-app').requestFullscreen)await document.querySelector('.game-app').requestFullscreen();
    else statusText.textContent='横屏查看效果更好';
  }catch{statusText.textContent='横屏查看效果更好';}
}
document.querySelectorAll('[data-character]').forEach(button=>button.addEventListener('click',()=>openCharacter(button.dataset.character)));
document.querySelector('#pause').addEventListener('click',togglePause);
document.querySelector('#sound').addEventListener('click',()=>{muted=!muted;if(player)player.volume=muted?0:1;updateStatus();});
document.querySelector('#restart').addEventListener('click',()=>openCharacter(character));
document.querySelector('#retry').addEventListener('click',()=>{
  if(loadDiagnostic.phase==='正在加载运行组件'){
    const url=new URL(location.href);
    url.searchParams.set('character',character);
    url.searchParams.set('retry',String(Date.now()));
    location.replace(url.href);
  }else openCharacter(character);
});
document.querySelector('#fullscreen').addEventListener('click',fullscreen);
document.addEventListener('keydown',event=>{
  if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
  if(event.code==='Space'){event.preventDefault();togglePause();}
  if(event.key.toLowerCase()==='f')fullscreen();
});
// The Windows launcher exits after its browser window stops sending heartbeats.
if(!window.__petEmbeddedMovie&&location.protocol==='http:'&&location.hostname==='127.0.0.1'){
  const ping=()=>fetch('/__ping',{cache:'no-store'}).catch(()=>{});
  ping();setInterval(ping,3000);
  window.addEventListener('pagehide',()=>navigator.sendBeacon('/__closing',''));
}
window.gameState=()=>({character,paused,muted,loaded,lastFrame,lastContext,finaleFrame});
window.gameDiagnostics=()=>({...loadDiagnostic});
openCharacter();
