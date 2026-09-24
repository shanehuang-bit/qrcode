'use strict';
let isReviewing = false;
let visitorRequestVersion = 0;
let visitorRecords = [];
const shell = document.getElementById('formSection');
const headerCard = shell.firstElementChild;
const reviewPanel = document.getElementById('pendingSection');
const dispatchPanel = document.createElement('section');
dispatchPanel.id = 'dispatchPanel';
for (const child of Array.from(shell.children)) {
  if (child !== headerCard && child !== reviewPanel) dispatchPanel.append(child);
}
const navigation = document.createElement('div');
navigation.className = 'management-tabs';
navigation.setAttribute('role', 'tablist');
navigation.setAttribute('aria-label', '業主管理功能');
const views = [['review','審核申請',reviewPanel],['visitors','檢視訪客',null],['dispatch','派發訪客',dispatchPanel],['account','帳號設定',null]];
const visitorPanel = document.createElement('section');
visitorPanel.className='card'; visitorPanel.id='visitorsPanel';
visitorPanel.innerHTML=`<div class="view-heading"><div><h2>檢視訪客</h2><p>依日期查看已核准的來訪紀錄。</p></div></div><form id="visitorSearch" class="query-controls"><div><label for="queryDate">來訪日期</label><input type="date" id="queryDate" required></div><button type="submit" id="queryButton" class="outline-button">查詢</button></form><div id="visitorResults" role="status" aria-live="polite"></div>`;
const accountPanel = document.createElement('section');
accountPanel.className='card account-panel'; accountPanel.id='accountPanel';
accountPanel.innerHTML=`<div class="view-heading"><h2>帳號設定</h2><p>更新顯示名稱或密碼；不需修改的欄位請留空。</p></div><div class="account-identity"><span>使用者帳號</span><strong id="accountUsername"></strong><span>目前顯示名稱</span><strong id="accountName"></strong></div><form id="accountForm"><label for="newDisplayName">新顯示名稱</label><input id="newDisplayName" type="text" maxlength="80" autocomplete="off"><div class="password-grid"><div><label for="newPassword">新密碼</label><input id="newPassword" type="password" autocomplete="new-password"></div><div><label for="confirmPassword">確認新密碼</label><input id="confirmPassword" type="password" autocomplete="new-password"></div></div><label for="currentPassword">目前密碼 <span class="req">*</span></label><input id="currentPassword" type="password" required autocomplete="current-password"><p class="settings-note">顯示名稱的調整不會移除通行郵件中的「姓名」欄位。</p><p id="accountFeedback" role="status" aria-live="polite"></p><button type="submit" id="saveAccount" class="login-btn">儲存變更</button></form>`;
views[1][2] = visitorPanel; views[3][2] = accountPanel;
for (const [id,label,panel] of views) {
  const button=document.createElement('button');button.type='button';button.id=`tab-${id}`;button.textContent=label;button.dataset.view=id;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);
  button.addEventListener('click',()=>activateView(id));navigation.append(button);
  panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
}
shell.append(navigation,reviewPanel,visitorPanel,dispatchPanel,accountPanel);
const reviewNote=document.createElement('p');reviewNote.className='view-note';reviewNote.textContent='顯示今日起 30 天內的待審核申請。';reviewPanel.querySelector('.pending-header').after(reviewNote);
const dialog=document.createElement('dialog');dialog.className='visitor-dialog';dialog.setAttribute('aria-labelledby','detailHeading');
dialog.innerHTML='<div class="dialog-heading"><h2 id="detailHeading">訪客詳細資料</h2><button type="button" id="closeDetail" class="outline-button">關閉</button></div><div id="detailContent"></div>';
document.body.append(dialog);document.getElementById('closeDetail').addEventListener('click',()=>dialog.close());
function activateView(id) {
  for (const [key,,panel] of views) {const selected=key===id;panel.hidden=!selected;const b=document.getElementById(`tab-${key}`);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}
  if(id==='visitors' && authUser) loadVisitors();
  if(id==='account') updateAccountIdentity();
}
navigation.addEventListener('keydown',e=>{const buttons=Array.from(navigation.children);const index=buttons.indexOf(document.activeElement);if(index<0)return;let next=index;if(e.key==='ArrowRight')next=(index+1)%buttons.length;else if(e.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].focus();activateView(buttons[next].dataset.view);});
function todayLocal(){const date=new Date();return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;}
function initializeManagement(){document.getElementById('queryDate').value=todayLocal();updateAccountIdentity();activateView('review');}
function resetManagement(){visitorRequestVersion++;pendingRequestVersion++;visitorRecords=[];document.getElementById('visitorResults').replaceChildren();document.getElementById('pendingContent').replaceChildren();document.getElementById('detailContent').replaceChildren();document.getElementById('accountForm').reset();document.getElementById('accountFeedback').textContent='';document.getElementById('accountUsername').textContent='';document.getElementById('accountName').textContent='';if(dialog.open)dialog.close();}
function updateAccountIdentity(){document.getElementById('accountUsername').textContent=authUser?.username||'';document.getElementById('accountName').textContent=authUser?.displayName||authUser?.username||'';}
function cell(value){const td=document.createElement('td');td.textContent=value??'—';return td;}
function timePart(value){return String(value||'').replace('T',' ').split(' ')[1]?.slice(0,5)||'—';}
async function loadVisitors(){
  if(!authUser)return;
  const request=++visitorRequestVersion, user=authUser;
  const date=document.getElementById('queryDate').value;
  const result=document.getElementById('visitorResults');
  if(!date){result.textContent='請選擇來訪日期。';return;}
  result.textContent='正在查詢訪客…';
  try{
    if(!user.buildingNo)throw new Error('此帳號未設定管轄大樓。');
    const data=await apiFetch('vas/visitor-application/query',{method:'POST',headers:{Authorization:`Bearer ${authToken}`},body:JSON.stringify({BuildingNo:user.buildingNo,VisitDate:date})});
    if(request!==visitorRequestVersion||authUser!==user)return;
    const eids=user.enterpriseIds.map(String);
    visitorRecords=(Array.isArray(data.DataList)?data.DataList:[]).filter(a=>a.VisitorStatus==='Y'&&eids.includes(String(a.EnterpriseId))).sort((a,b)=>String(a.VisitorStartTime).localeCompare(String(b.VisitorStartTime)));
    result.replaceChildren();
    if(!visitorRecords.length){result.className='empty-state';result.textContent='這一天沒有已核准的訪客。';return;}
    result.className='';const count=document.createElement('p');count.className='view-note';count.textContent=`共 ${visitorRecords.length} 筆已核准申請`;result.append(count);
    const wrap=document.createElement('div');wrap.className='table-wrap';const table=document.createElement('table');table.className='pending-table';
    const thead=document.createElement('thead'),head=document.createElement('tr');for(const title of ['訪客姓名','來訪公司','來訪時間','人數','到訪事由','詳細資料']){const th=document.createElement('th');th.scope='col';th.textContent=title;head.append(th);}thead.append(head);table.append(thead);const body=document.createElement('tbody');
    for(const record of visitorRecords){const tr=document.createElement('tr');tr.append(cell(record.VisitorList?.map(v=>v.VisitorName).filter(Boolean).join('、')||'未提供'),cell(record.VisitorCompany),cell(`${timePart(record.VisitorStartTime)} – ${timePart(record.VisitorEndTime)}`),cell(record.VisitorCount),cell(record.VisitorReason));const action=cell('');const button=document.createElement('button');button.type='button';button.className='outline-button';button.textContent='查看';button.addEventListener('click',()=>showVisitorDetail(record));action.append(button);tr.append(action);body.append(tr);}table.append(body);wrap.append(table);result.append(wrap);
  }catch(error){if(request!==visitorRequestVersion||authUser!==user)return;result.className='query-error';result.textContent=`無法載入訪客：${error.message}。請重試；登入逾時時請重新登入。`;}
}
function showVisitorDetail(record){const content=document.getElementById('detailContent');content.replaceChildren();const dl=document.createElement('dl');dl.className='detail-list';for(const [label,value] of [['申請編號',record.ApplyNo],['來訪公司',record.VisitorCompany],['拜訪公司',record.EnterpriseId],['開始時間',record.VisitorStartTime],['結束時間',record.VisitorEndTime],['到訪事由',record.VisitorReason]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value||'—';dl.append(dt,dd);}content.append(dl);for(const [index,visitor] of (record.VisitorList||[]).entries()){const block=document.createElement('section');block.className='detail-visitor';const title=document.createElement('h3');title.textContent=`訪客 ${index+1} · ${visitor.VisitorName||'未提供姓名'}`;block.append(title);for(const [label,value] of [['公司',visitor.VisitorCompany],['電話',visitor.VisitorPhone],['Email',visitor.VisitorEmail]]){const line=document.createElement('p');line.textContent=`${label}：${value||'—'}`;block.append(line);}content.append(block);}dialog.showModal();}
document.getElementById('visitorSearch').addEventListener('submit',event=>{event.preventDefault();loadVisitors();});
document.getElementById('accountForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!authUser)return;
  const feedback=document.getElementById('accountFeedback'),button=document.getElementById('saveAccount');
  if(button.disabled)return;
  const name=document.getElementById('newDisplayName').value.trim(),next=document.getElementById('newPassword').value,repeat=document.getElementById('confirmPassword').value,current=document.getElementById('currentPassword').value;
  feedback.className='query-error';
  if(!name&&!next&&!repeat){feedback.textContent='請填寫新的顯示名稱或密碼。';return;}
  if(next!==repeat){feedback.textContent='兩次輸入的新密碼不一致。';return;}
  if(!current){feedback.textContent='請輸入目前密碼。';return;}
  if(!confirm('確定更新這個帳號的設定？更新後需要重新登入。'))return;
  const user=authUser;button.disabled=true;feedback.className='';feedback.textContent='正在驗證並儲存…';
  try{
    const verified=await apiFetch('vas/company-staff/login',{method:'POST',body:JSON.stringify({username:user.username,password:current})});
    if(!verified.Data?.token)throw new Error('無法驗證目前密碼');
    if(authUser!==user)throw new Error('登入狀態已變更，請重新登入');
    await apiFetch('vas/company-staff',{method:'PUT',headers:{Authorization:`Bearer ${verified.Data.token}`},body:JSON.stringify({username:user.username,display_name:name||user.displayName||user.username,password:next||current})});
    handleLogout();showError(document.getElementById('loginError'),'帳號設定已更新，請使用更新後的資料重新登入。');
  }catch(error){feedback.className='query-error';feedback.textContent=`無法更新：${error.message}`;}
  finally{button.disabled=false;for(const id of ['currentPassword','newPassword','confirmPassword'])document.getElementById(id).value='';}
});
document.getElementById('newAppBtn').addEventListener('click',()=>activateView('dispatch'));
activateView('review');
