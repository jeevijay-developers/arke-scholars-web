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
  footer,
  h1,
  header,
  main,
  text,
} from './_styles.ts'

interface Props {
  name?: string
  appUrl?: string
}

const WelcomeEmail = ({ name, appUrl = 'https://arke.pro' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — let&apos;s start your prep journey</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{SITE_NAME}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {name ? `Welcome, ${name}!` : 'Welcome aboard!'}
          </Heading>
          <Text style={text}>
            We&apos;re thrilled to have you join {SITE_NAME}. Your dashboard is ready
            with personalised courses, live classes, mock tests and 24×7 doubt
            support — everything you need to crack your exam.
          </Text>
          <Text style={text}>
            Set your study goal, pick your target exam, and dive into your first
            lesson today.
          </Text>
          <Button href={`${appUrl}/dashboard`} style={button}>
            Go to dashboard
          </Button>
        </Section>
        <Text style={footer}>
          Need help? Just reply to this email — we&apos;re here for you.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME}`,
  displayName: 'Welcome',
  previewData: { name: 'Aanya' },
} satisfies TemplateEntry
