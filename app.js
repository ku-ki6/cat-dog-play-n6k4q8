/* Local playback only. Original movie timing and attack controls remain inside the SWF. */
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
let player=null,character='cat',paused=false,muted=false,loadSerial=0;
let lastFrame=594,lastContext=0,finaleFrame=0,loaded=false;
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
  character=next;paused=false;loaded=false;lastFrame=594;lastContext=0;finaleFrame=0;
  loading.hidden=false;failure.hidden=true;
  for(const button of document.querySelectorAll('[data-character]')){
    button.setAttribute('aria-pressed',String(button.dataset.character===character));
    button.classList.toggle('selected',button.dataset.character===character);
  }
  statusText.textContent=`正在准备${names[character]}`;
  if(player){player.remove();player=null;}
  const nextPlayer=window.RufflePlayer.newest().createPlayer();
  nextPlayer.setAttribute('aria-label',`${names[character]}游戏，点击右侧数字按钮出招`);
  stage.replaceChildren(nextPlayer);player=nextPlayer;
  const observeFrame=message=>{
    const match=/PET_FRAME:(\d+):(\d+)/.exec(message);
    if(match&&serial===loadSerial&&(Number(match[1])===0||Number(match[1])===641)){
      lastContext=Number(match[1]);lastFrame=Number(match[2]);
      if(lastContext===641)finaleFrame=lastFrame;
      if(!loaded&&lastContext===0&&lastFrame>=594){loaded=true;loading.hidden=true;}
      updateStatus();
    }
  };
  try{
    const movie=window.__petEmbeddedMovie?{data:window.__petEmbeddedMovie(character)}:{url:`assets/${character}.swf`};
    await nextPlayer.load({...movie,fontSources:[],parameters:{}});
    if(serial!==loadSerial)return;
    nextPlayer.traceObserver=observeFrame;
    nextPlayer.volume=muted?0:1;
    const deadline=Date.now()+15000;
    while(!loaded&&Date.now()<deadline&&serial===loadSerial){
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(serial!==loadSerial)return;
    if(!loaded&&nextPlayer.metadata){loaded=true;loading.hidden=true;}
    if(!loaded)throw new Error('游戏加载超时');
    updateStatus();
  }catch(error){
    if(serial!==loadSerial)return;
    loading.hidden=true;failure.hidden=false;
    document.querySelector('#failure-message').textContent='游戏没有打开。请刷新重试，或从微信右上角选择“在浏览器打开”。';
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
document.querySelector('#retry').addEventListener('click',()=>openCharacter(character));
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
openCharacter();
