import Swal from 'sweetalert2';

// 🔥 Override alert globally
window.alert = function (message) {
  return Swal.fire({
    icon: 'info',
    title: message,
    confirmButtonColor: '#00a884',
    background: '#1f2c33',
    color: '#ffffff'
  });
};

// 🔥 Override confirm globally
window.confirm = async function (message) {
  const result = await Swal.fire({
    title: message,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    background: '#1f2c33',
    color: '#ffffff'
  });

  return result.isConfirmed;
};
