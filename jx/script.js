$(document).ready(function() {
  toastr.options = {
    "closeButton": true,
    "progressBar": true,
    "positionClass": "toast-top-right" // You can adjust the position
  };

  $("#showSuccess").click(function() {
    toastr.success("This is a success notification!");
  });

  $("#showError").click(function() {
    toastr.error("This is an error notification!");
  });

  $("#showWarning").click(function() {
    toastr.warning("This is a warning notification!");
  });

  $("#showInfo").click(function() {
    toastr.info("This is an info notification!");
  });
});
