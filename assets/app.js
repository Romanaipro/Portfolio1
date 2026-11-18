'use strict';
document.body.classList.add('js');
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const menu=document.querySelector('.menu-toggle');
const nav=document.querySelector('#navigation');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});
nav.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.setAttribute('aria-expanded','false');nav.classList.remove('open');menu.focus();}});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');nav.classList.remove('open');}));
const cards=[...document.querySelectorAll('.case-card')];
let filter='all',expanded=false;
function renderCases(){
  let count=0;
  cards.forEach((card,i)=>{const visible=(filter==='all'||card.dataset.category.split(' ').includes(filter))&&(expanded||i<3);card.hidden=!visible;if(visible)count++;});
  document.querySelector('#case-count').textContent=expanded?`Показано робіт: ${count} із 6`:'Вибрані роботи: 3 із 6';
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
  document.querySelector('#show-all').hidden=expanded;
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;expanded=true;renderCases();}));
document.querySelector('#show-all').addEventListener('click',()=>{expanded=true;renderCases();const status=document.querySelector('#case-count');status.tabIndex=-1;status.focus({preventScroll:true});});
let activeDialog=null,opener=null,returnHash='#cases',openedFromPage=false;
function hideDialog(restore=true){if(!activeDialog)return;const dialog=activeDialog;activeDialog=null;dialog.close();if(restore&&opener?.isConnected)opener.focus({preventScroll:true});}
function syncHash(){
  const match=location.hash.match(/^#case\/([\w-]+)$/);
  if(!match){hideDialog();return;}
  const target=document.getElementById('case-'+match[1]);if(!target||activeDialog===target)return;
  hideDialog(false);activeDialog=target;target.showModal();target.querySelector('h2').focus({preventScroll:true});
}
document.querySelectorAll('[data-case-link]').forEach(link=>link.addEventListener('click',()=>{opener=link;returnHash=location.hash.startsWith('#case/')?'#cases':location.hash||'#cases';openedFromPage=true;}));
function closeCase(){
  if(activeDialog?.id.startsWith('case-')){if(openedFromPage){history.back();}else{history.replaceState(null,'',returnHash);hideDialog();}}
  else hideDialog();
}
window.addEventListener('hashchange',syncHash);
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelector('.close-dialog').addEventListener('click',closeCase);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeCase();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeCase();}});
  dialog.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const focusables=[...dialog.querySelectorAll('button,a[href],input,textarea,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=focusables[0],last=focusables.at(-1);
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.querySelector('h2'))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  });
});
document.querySelectorAll('[data-certificate]').forEach(button=>button.addEventListener('click',()=>{hideDialog(false);opener=button;activeDialog=document.getElementById('cert-'+button.dataset.certificate);activeDialog.showModal();activeDialog.querySelector('h2').focus();}));
document.querySelectorAll('[data-copy-case]').forEach(link=>link.addEventListener('click',async event=>{event.preventDefault();const url=new URL(link.getAttribute('href'),location.href).href;const status=link.nextElementSibling;try{await navigator.clipboard.writeText(url);status.textContent='Посилання скопійовано';}catch{status.textContent=url;}}));
const form=document.querySelector('#contact-form');
const status=document.querySelector('#form-status');
const error=document.querySelector('#form-error');
const submitButton=form.querySelector('[type=submit]');
const contactInput=document.querySelector('#contact-input');
let submitting=false;
const submit=PortfolioForm.createSubmission();
const getData=()=>Object.fromEntries(new FormData(form));
function updateDraft(){const data=getData();document.querySelector('#telegram-draft').href='https://t.me/romanmuronchuk?text='+encodeURIComponent(`Вітаю, Романе!\nІм’я: ${data.name}\nКонтакт: ${data.contact}\nЗадача: ${data.description}`);}
form.addEventListener('input',()=>{contactInput.setCustomValidity('');updateDraft();});
document.querySelectorAll('[data-context]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault();hideDialog(false);
  const textarea=document.querySelector('#description');const previous=textarea.dataset.context||'';
  const ownText=previous&&textarea.value.startsWith(previous)?textarea.value.slice(previous.length).trim():textarea.value.trim();
  const context=link.dataset.context;textarea.value=context+(ownText?'\n\n'+ownText:'');textarea.dataset.context=context;
  history.pushState(null,'','#contact');document.querySelector('#contact').scrollIntoView({behavior:reduced()?'instant':'smooth'});document.querySelector('#name').focus({preventScroll:true});updateDraft();
}));
form.addEventListener('submit',async event=>{
  event.preventDefault();if(submitting)return;
  const contact=contactInput.value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)&&!/^@[A-Za-z0-9_]{5,32}$/.test(contact)&&!/^\+?[\d\s()\-]{9,20}$/.test(contact)){
    contactInput.setCustomValidity('Вкажіть email, телефон або Telegram у форматі @username.');contactInput.reportValidity();return;
  }
  if(!form.reportValidity())return;
  submitting=true;submitButton.disabled=true;form.setAttribute('aria-busy','true');status.textContent='Надсилаємо заявку…';error.textContent='';
  const data=getData();for(const field of form.querySelectorAll('input,textarea'))field.readOnly=true;
  const result=await submit(data);
  submitting=false;submitButton.disabled=false;form.removeAttribute('aria-busy');for(const field of form.querySelectorAll('input,textarea'))field.readOnly=false;
  if(result.status==='accepted'){
    status.textContent='Сервер прийняв вашу заявку. Дякую за звернення!';form.reset();delete document.querySelector('#description').dataset.context;updateDraft();status.focus();
  }else{
    status.textContent='';error.textContent=result.status==='error'?'Сервер повернув помилку. Дані збережено. Можна повторити спробу або написати напряму.':'Не вдалося підтвердити прийняття заявки. Сервер міг її отримати. Дані збережено — перевірте напряму в Telegram перед повтором.';
    error.tabIndex=-1;error.focus();
  }
});
form.hidden=false;
syncHash();
