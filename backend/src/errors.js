export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// SQLSTATE codes raised by constraints, triggers and procedures -> HTTP status.
const STATUS_BY_SQLSTATE = {
  '22001': 400, // string_data_right_truncation (value too long)
  '22P02': 400, // invalid_text_representation (e.g. "abc" for an INT)
  '22023': 400, // invalid_parameter_value (RAISEd by place_order)
  '23502': 400, // not_null_violation
  '23503': 400, // foreign_key_violation
  '23505': 409, // unique_violation
  '23514': 409, // check_violation (CHECK constraints and business-rule RAISEs)
  P0002: 404, //   no_data_found (RAISEd by cancel_order)
};

const CONSTRAINT_MESSAGES = {
  customers_email_key: 'An account with this email already exists',
  chk_customer_email: 'Please enter a valid email address',
  chk_customer_phone: 'Phone number must be 10 to 14 digits',
  chk_address_pincode: 'Pincode must be 6 digits and cannot start with 0',
  chk_inventory_stock: 'Stock cannot go below zero',
  chk_inventory_reorder: 'Reorder level cannot be negative',
  chk_payment_method: 'Unsupported payment method',
  chk_event_status: 'Unknown tracking status',
};

export function toHttpError(err) {
  if (err instanceof HttpError) return err;
  if (err.type === 'entity.parse.failed') return new HttpError(400, 'Malformed JSON body');
  const status = STATUS_BY_SQLSTATE[err.code];
  if (status) return new HttpError(status, CONSTRAINT_MESSAGES[err.constraint] ?? err.message);
  return new HttpError(500, 'Internal server error');
}
