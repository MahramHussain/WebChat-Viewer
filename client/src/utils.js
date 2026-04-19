export const formatNiceDate = (rawDateStr) => {
  try {
    const [datePart] = rawDateStr.split(' ');
    const parts = datePart.split('/');
    if (parts.length === 3) {
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10);
      let yearStr = parts[2];
      let year = parseInt(yearStr.length === 2 ? `20${yearStr}` : yearStr, 10);

      if (month > 12) {
        const temp = month;
        month = day;
        day = temp;
      }

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      if (month >= 1 && month <= 12) {
        return `${day} ${monthNames[month - 1]}, ${year}`;
      }
    }
    return rawDateStr;
  } catch {
    return rawDateStr;
  }
};
