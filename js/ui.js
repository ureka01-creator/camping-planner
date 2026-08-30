const backdrop = document.getElementById('modalBackdrop');
const content = document.getElementById('modalContent');
const toastEl = document.getElementById('toast');
let toastTimer;

export function toast(message){
  clearTimeout(toastTimer);
  toastEl.textContent=message;
  toastEl.classList.remove('hidden');
  toastTimer=setTimeout(()=>toastEl.classList.add('hidden'),1700);
}

export function openModal(html, onOpen){
  content.innerHTML=html;
  backdrop.classList.remove('hidden');
  backdrop.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
  content.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closeModal));
  onOpen?.(content);
}
export function closeModal(){
  backdrop.classList.add('hidden');
  backdrop.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
  content.innerHTML='';
}
backdrop.addEventListener('click', e => { if(e.target===backdrop) closeModal(); });

export function esc(value=''){
  return String(value).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

export function uid(prefix='id'){
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
}
