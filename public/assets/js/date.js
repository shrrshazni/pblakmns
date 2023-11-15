exports.getDate = function () {
  const today = new Date();

  const options = {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  };

  return today.toLocaleDateString('en-MY', options);
};

exports.getDay = function () {
  const today = new Date();

  const options = {
    weekday: 'long'
  };

  return today.toLocaleDateString('en-MY', options);
};

exports.getDateYear = function () {
  const today = new Date();

  const options = {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  };

  return today.toLocaleDateString('en-MY', options);
};

exports.getCurrentTime = function () {
  // Create a new Date object representing the current date and time
  const now = new Date();

  // Get the current time components
  let hours = now.getHours();
  const minutes = now.getMinutes();

  // Determine whether it's AM or PM
  const ampm = hours >= 12 ? 'pm' : 'am';

  // Convert hours to 12-hour format
  hours = hours % 12 || 12;

  // Format the time components as a string with AM/PM
  const formattedTime = `${hours}:${minutes} ${ampm}`;

  return formattedTime;
};
