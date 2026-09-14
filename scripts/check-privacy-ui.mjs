import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
export async function checkPrivacy({page,backend,output,errors,requests}) {
  const textWarnings=[];page.on('console',message=>{if(message.text().includes('Unexpected text node'))textWarnings.push(message.text());});
  await page.getByText('Welcome home, alice.',{exact:true}).waitFor();await page.emulateMedia({reducedMotion:'reduce'});
  const skip=page.getByRole('button',{name:'Skip to my palace',exact:true});if(await skip.isVisible())await skip.click();
  await page.getByRole('button',{name:'Account',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Find someone to talk to',exact:true}).count(),0);
  const privacy=page.getByRole('button',{name:'Chat backups & privacy',exact:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(output,'00-account-menu-phone.png')});
  await privacy.click();await page.getByRole('button',{name:'Create a local backup',exact:true}).waitFor();
  await page.setViewportSize({width:1440,height:1200});
  const response=await fetch(backend.url+'/chat/owner-bob/messages',{method:'POST',headers:{Authorization:'Bearer alice','Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),text:'SYNTHETIC_BACKUP_PRIVATE_WORDS',confirmed:true})});assert.equal(response.status,200);
  await page.getByRole('button',{name:'Create a local backup',exact:true}).click();await page.getByRole('button',{name:'I saved my key · save backup',exact:true}).waitFor();
  const key=await page.getByText(/^[a-f0-9]{64}$/).textContent();assert.equal(key.length,64);assert.ok(!requests.some(r=>r.body?.includes(key)));
  await page.getByRole('button',{name:'I saved my key · save backup',exact:true}).click();await page.getByRole('button',{name:'Open encrypted archive',exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'01-royal-archive-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Open encrypted archive',exact:true}).click();await page.getByRole('textbox',{name:'Backup recovery key'}).fill(key);await page.getByRole('button',{name:'Open archive',exact:true}).click();await page.getByText('SYNTHETIC_BACKUP_PRIVATE_WORDS',{exact:true}).waitFor();assert.equal(backend.fixture.state.chatMessages.length,1);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(output,'02-archive-reader-phone.png')});await page.getByRole('button',{name:'Close dialog',exact:true}).last().click();
  const crypto=await page.evaluate(async()=>{
    const archive={version:1,ownerKey:'synthetic-owner',createdAt:new Date().toISOString(),conversations:[]};const e=await window.__phase10.encryptArchive(archive);let wrong=false,tampered=false,other=false;
    try{await window.__phase10.decryptArchive(e.envelope,'0'.repeat(64),'synthetic-owner');}catch{wrong=true;}
    try{await window.__phase10.decryptArchive({...e.envelope,data:(e.envelope.data[0]==='A'?'B':'A')+e.envelope.data.slice(1)},e.recoveryKey,'synthetic-owner');}catch{tampered=true;}
    try{await window.__phase10.decryptArchive(e.envelope,e.recoveryKey,'different-owner');}catch{other=true;}
    const opened=await window.__phase10.decryptArchive(e.envelope,e.recoveryKey,'synthetic-owner');return {wrong,tampered,other,owner:opened.ownerKey};
  });assert.deepEqual(crypto,{wrong:true,tampered:true,other:true,owner:'synthetic-owner'});
  await page.getByRole('button',{name:'Remove my account',exact:true}).click();
  const confirm=page.getByRole('button',{name:'Permanently remove my account',exact:true});const username=page.getByRole('textbox',{name:'Confirm username for account removal'});
  assert.equal(await confirm.getAttribute('aria-disabled'),'true');await username.fill('wrong_username');assert.equal(await confirm.getAttribute('aria-disabled'),'true');await username.fill('');
  await page.screenshot({path:resolve(output,'03-account-removal-dialog-phone.png')});
  await page.getByRole('button',{name:'Keep my palace',exact:true}).click();assert.equal(requests.filter(request=>request.path==='/account/delete').length,0);
  await page.getByRole('button',{name:'Remove my account',exact:true}).click();await username.fill('alice');await confirm.click();await page.waitForFunction(()=>localStorage.getItem('lantern-account-closed-v1-owner-alice')==='closed');assert.equal(backend.fixture.state.users[0].accountState,'DELETING');
  const cleanup=await page.evaluate(async()=>{localStorage.setItem('lantern-draft-v1-owner-alice','private');localStorage.setItem('lantern-draft-v1-owner-bob','other-account');await window.__phase10.eraseLocalAccount('owner-alice');let fenced=false;try{window.__phase10.draftStorage.write('lantern-draft-v1-owner-alice','late-write');}catch{fenced=true;}return {fenced,alice:localStorage.getItem('lantern-draft-v1-owner-alice'),bob:localStorage.getItem('lantern-draft-v1-owner-bob')};});assert.deepEqual(cleanup,{fenced:true,alice:null,bob:'other-account'});
  const resumed=await page.evaluate(async()=>{localStorage.setItem('lantern-draft-v1-owner-alice','late interrupted write');await window.__phase10.erasePreviouslyClosedAccounts();return {alice:localStorage.getItem('lantern-draft-v1-owner-alice'),bob:localStorage.getItem('lantern-draft-v1-owner-bob')};});assert.deepEqual(resumed,{alice:null,bob:'other-account'});
  assert.ok(!requests.filter(r=>r.path.includes('/backups/drive/files')).some(r=>r.body?.includes('SYNTHETIC_BACKUP_PRIVATE_WORDS')));assert.deepEqual(errors,[]);assert.deepEqual(textWarnings,[]);
  console.log('Privacy browser checks passed: visible account privacy action, removed account support shortcut, no raw text-node warnings during empty/edited/reopened removal dialogs, exact confirmation/cancellation, encrypted backup save/open and account cleanup.');
}
