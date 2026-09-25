import React from 'react';

interface BillingNoticeProps {
  serviceCode: string;
}

/**
 * Says plainly that nothing has been charged.
 *
 * The booking publishes a service code for the billing service, but that service arrives in
 * Sprint 4 — so a patient who saw a code and no invoice would reasonably wonder whether they owed
 * something. Shown on both the confirm screen and the confirmation, so it cannot be missed.
 */
const BillingNotice: React.FC<BillingNoticeProps> = ({ serviceCode }) => (
  <p className="field-help booking-billing-notice" data-testid="billing-notice">
    No payment is taken now and no invoice is issued yet — billing arrives in Sprint&nbsp;4. This
    visit is recorded as <strong>{serviceCode}</strong>.
  </p>
);

export default BillingNotice;
