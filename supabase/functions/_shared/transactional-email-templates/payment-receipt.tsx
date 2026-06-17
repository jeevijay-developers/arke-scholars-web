import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import {
  SITE_NAME,
  brand,
  button,
  card,
  container,
  divider,
  footer,
  h1,
  header,
  label,
  main,
  stat,
  text,
} from './_styles.ts'

interface Props {
  customerName?: string
  itemName?: string
  amount?: string // formatted with currency e.g. "₹4,999"
  paymentMethod?: string
  transactionId?: string
  paidAt?: string
  appUrl?: string
}

const PaymentReceiptEmail = ({
  customerName,
  itemName = 'your purchase',
  amount,
  paymentMethod,
  transactionId,
  paidAt,
  appUrl = 'https://arke.pro',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Payment received for {itemName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{SITE_NAME}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {customerName ? `Thank you, ${customerName}!` : 'Payment received'}
          </Heading>
          <Text style={text}>
            We&apos;ve received your payment. Here&apos;s your receipt for your records.
          </Text>
          <div style={divider} />
          <Text style={label}>Item</Text>
          <Text style={stat}>{itemName}</Text>
          {amount && (
            <>
              <Text style={{ ...label, marginTop: '12px' }}>Amount paid</Text>
              <Text style={{ ...stat, fontSize: '20px', color: '#C99A2E' }}>{amount}</Text>
            </>
          )}
          {paymentMethod && (
            <>
              <Text style={{ ...label, marginTop: '12px' }}>Payment method</Text>
              <Text style={stat}>{paymentMethod}</Text>
            </>
          )}
          {transactionId && (
            <>
              <Text style={{ ...label, marginTop: '12px' }}>Transaction ID</Text>
              <Text style={{ ...stat, fontFamily: 'monospace', fontSize: '12px' }}>{transactionId}</Text>
            </>
          )}
          {paidAt && (
            <>
              <Text style={{ ...label, marginTop: '12px' }}>Paid on</Text>
              <Text style={stat}>{paidAt}</Text>
            </>
          )}
          <div style={divider} />
          <Button href={`${appUrl}/my-courses`} style={button}>
            Access your content
          </Button>
        </Section>
        <Text style={footer}>
          Questions about this charge? Just reply to this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PaymentReceiptEmail,
  subject: (data: Record<string, any>) =>
    `Receipt for ${data.itemName || 'your purchase'} — ${SITE_NAME}`,
  displayName: 'Payment receipt',
  previewData: {
    customerName: 'Aanya',
    itemName: 'JEE Advanced Crash Course',
    amount: '₹4,999',
    paymentMethod: 'Razorpay (UPI)',
    transactionId: 'pay_NqXyZ123abc',
    paidAt: '2 May 2026, 3:42 PM IST',
  },
} satisfies TemplateEntry
