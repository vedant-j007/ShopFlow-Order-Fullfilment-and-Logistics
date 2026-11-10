import { Banknote, CreditCard, Landmark, Smartphone, Wallet } from 'lucide-react';

// Values match the CHECK constraint chk_payment_method on PAYMENTS.
export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI', hint: 'Pay instantly with any UPI app', icon: Smartphone },
  { value: 'card', label: 'Credit / debit card', hint: 'Visa, Mastercard, RuPay', icon: CreditCard },
  { value: 'netbanking', label: 'Net banking', hint: 'All major banks', icon: Landmark },
  { value: 'wallet', label: 'Wallet', hint: 'Paytm, PhonePe, Amazon Pay', icon: Wallet },
  { value: 'cod', label: 'Cash on delivery', hint: 'Order stays pending until delivered', icon: Banknote },
];

export const paymentLabel = (value) => PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
