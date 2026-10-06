export const money = (n: number | string | null | undefined) =>
  n == null ? "Quote" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Dates of birth are stored as plain dates; format them without a time zone shift.
export const fmtDob = (d: Date | string) => {
  const iso = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split("-");
  return `${m}/${day}/${y}`;
};

export const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  sent: "Sent to pharmacy",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
export const NEXT_STATUS: Record<string, string | undefined> = { submitted: "sent", sent: "shipped", shipped: "delivered" };

export const CATEGORY_ORDER = [
  "Hormones",
  "Weight loss",
  "Peptides",
  "Wellness & IV",
  "Sexual health",
  "Thyroid",
  "Dermatology & hair",
  "General Rx",
  "Supplies",
];

export const US_STATES =
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
