import { dataAdapter } from './firebase.js';
import { toast } from './ui.js';

const startInput = document.getElementById('tripStartDateInput');
const endInput = document.getElementById('tripEndDateInput');
const saveButton = document.getElementById('saveTripDatesBtn');

let latestTrip = null;

if (startInput && endInput && saveButton) {
  dataAdapter.subscribe(data => {
    latestTrip = data?.trip || null;
    if (!latestTrip) return;
    if (document.activeElement !== startInput) startInput.value = latestTrip.startDate || '';
    if (document.activeElement !== endInput) endInput.value = latestTrip.endDate || '';
  });

  saveButton.addEventListener('click', async () => {
    const startDate = startInput.value;
    const endDate = endInput.value;

    if (!startDate || !endDate) {
      toast('시작일과 종료일을 모두 선택해줘.');
      return;
    }
    if (endDate < startDate) {
      toast('종료일은 시작일보다 빠를 수 없어.');
      return;
    }

    saveButton.disabled = true;
    try {
      await dataAdapter.mutate(data => {
        data.trip.startDate = startDate;
        data.trip.endDate = endDate;
      });
      toast('캠핑 일정을 저장했어.');
    } catch (error) {
      console.error(error);
      toast('일정 저장에 실패했어.');
      if (latestTrip) {
        startInput.value = latestTrip.startDate || '';
        endInput.value = latestTrip.endDate || '';
      }
    } finally {
      saveButton.disabled = false;
    }
  });
}
