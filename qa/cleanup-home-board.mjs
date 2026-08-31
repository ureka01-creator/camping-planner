const API_KEY = 'AIzaSyCdBMIYmhomv-B72pzEptpfRIoGiORZZWk';
const PROJECT_ID = 'camping-planner-4c2bd';
const TARGET_NAME = '민지네';
const TARGET_TEXT = '안녕하세요, 캠핑 플래너 입니다. 반갑습니다.';

function fieldString(field) {
  return String(field?.stringValue || '');
}

const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ returnSecureToken:true })
});
if (!authResponse.ok) throw new Error(`anonymous auth failed: ${authResponse.status} ${await authResponse.text()}`);
const auth = await authResponse.json();
const token = auth.idToken;

const listUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/trips?pageSize=100`;
const listResponse = await fetch(listUrl, { headers:{ authorization:`Bearer ${token}` } });
if (!listResponse.ok) throw new Error(`trip list failed: ${listResponse.status} ${await listResponse.text()}`);
const payload = await listResponse.json();
const docs = Array.isArray(payload.documents) ? payload.documents : [];

let removed = 0;
let touched = 0;
for (const doc of docs) {
  const trip = doc?.fields?.trip?.mapValue?.fields;
  const memoValues = trip?.homeMemos?.arrayValue?.values;
  if (!Array.isArray(memoValues) || !memoValues.length) continue;

  const kept = memoValues.filter(value => {
    const fields = value?.mapValue?.fields || {};
    const match = fieldString(fields.name) === TARGET_NAME && fieldString(fields.text) === TARGET_TEXT;
    if (match) removed += 1;
    return !match;
  });
  if (kept.length === memoValues.length) continue;

  const updateUrl = `${doc.name}?updateMask.fieldPaths=trip.homeMemos`;
  const body = {
    fields: {
      trip: {
        mapValue: {
          fields: {
            homeMemos: {
              arrayValue: { values: kept }
            }
          }
        }
      }
    }
  };
  const updateResponse = await fetch(updateUrl, {
    method:'PATCH',
    headers:{ authorization:`Bearer ${token}`, 'content-type':'application/json' },
    body:JSON.stringify(body)
  });
  if (!updateResponse.ok) throw new Error(`cleanup write failed for ${doc.name}: ${updateResponse.status} ${await updateResponse.text()}`);
  touched += 1;
}

console.log(JSON.stringify({ scanned:docs.length, touched, removed, targetName:TARGET_NAME, targetText:TARGET_TEXT }, null, 2));
if (removed < 1) throw new Error('target home board post was not found');
