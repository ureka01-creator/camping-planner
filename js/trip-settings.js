import { dataAdapter } from './firebase.js';
import { toast } from './ui.js';

const startInput = document.getElementById('tripStartDateInput');
const endInput = document.getElementById('tripEndDateInput');
const saveButton = document.getElementById('saveTripDatesBtn');

let latestTrip = null;

function syncDateBounds({ adjustEnd = false } = {}) {
  if (!startInput || !endInput) return;
  const startDate = startInput.value;

  if (startDate) endInput.min = startDate;
  else endInput.removeAttribute('min');

  if (adjustEnd && startDate && (!endInput.value || endInput.value < startDate)) {
    endInput.value = startDate;
  }
}

if (startInput && endInput && saveButton) {
  dataAdapter.subscribe(data => {
    latestTrip = data?.trip || null;
    if (!latestTrip) return;

    if (document.activeElement !== startInput) startInput.value = latestTrip.startDate || '';
    if (document.activeElement !== endInput) endInput.value = latestTrip.endDate || '';
    syncDateBounds();
  });

  startInput.addEventListener('input', () => syncDateBounds({ adjustEnd: true }));
  startInput.addEventListener('change', () => syncDateBounds({ adjustEnd: true }));
  endInput.addEventListener('change', () => {
    if (startInput.value && endInput.value < startInput.value) {
      endInput.value = startInput.value;
    }
  });

  saveButton.addEventListener('click', async () => {
    const startDate = startInput.value;
    let endDate = endInput.value;

    if (!startDate || !endDate) {
      toast('시작일과 종료일을 모두 선택해줘.');
      return;
    }
    if (endDate < startDate) {
      endDate = startDate;
      endInput.value = startDate;
    }

    saveButton.disabled = true;
    const beforeText = saveButton.textContent;
    saveButton.textContent = '저장 중…';

    try {
      await dataAdapter.mutate(data => {
        data.trip.startDate = startDate;
        data.trip.endDate = endDate;
      });
      latestTrip = { ...(latestTrip || {}), startDate, endDate };
      syncDateBounds();
      toast('캠핑 일정을 저장했어.');
    } catch (error) {
      console.error(error);
      toast('일정 저장에 실패했어.');
      if (latestTrip) {
        startInput.value = latestTrip.startDate || '';
        endInput.value = latestTrip.endDate || '';
        syncDateBounds();
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = beforeText;
    }
  });
}
