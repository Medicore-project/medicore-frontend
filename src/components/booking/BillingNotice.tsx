import React from 'react';

interface BillingNoticeProps {
  serviceCode: string;
}

/**
 * Explains the automatic-invoice lifecycle without implying that payment is taken during booking.
 * Shown on both the confirm screen and the confirmation, so it cannot be missed.
 */
const BillingNotice: React.FC<BillingNoticeProps> = ({ serviceCode }) => (
  <p className="field-help booking-billing-notice" data-testid="billing-notice">
    No payment is taken now. Confirming creates a draft invoice for{' '}
    <strong>{serviceCode}</strong>; it becomes payable after the visit is completed.
  </p>
);

export default BillingNotice;
