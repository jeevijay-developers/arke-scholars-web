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
  email: string
  tempPassword: string
  loginUrl?: string
}

const credBox: React.CSSProperties = {
  backgroundColor: '#FFFBF5',
  border: '1px solid #F1E7D7',
  borderRadius: '8px',
  padding: '14px 16px',
  margin: '12px 0 20px',
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#1E293B',
  lineHeight: '1.7',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#64748B',
  margin: '0 0 4px',
  fontFamily: 'Arial, sans-serif',
}

const TeacherCredentialsEmail = ({ name, email, tempPassword, loginUrl = 'https://arke.pro/login' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} teacher account is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{SITE_NAME}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {name ? `Welcome, ${name}!` : 'Welcome to the team!'}
          </Heading>
          <Text style={text}>
            Your teacher account on {SITE_NAME} has been created. Use the
            credentials below to sign in. You&apos;ll be asked to set a new
            password on your first login.
          </Text>

          <div style={credBox}>
            <p style={labelStyle}>Login email</p>
            <div style={{ marginBottom: '10px' }}>{email}</div>
            <p style={labelStyle}>Temporary password</p>
            <div>{tempPassword}</div>
          </div>

          <Button href={loginUrl} style={button}>
            Sign in to your account
          </Button>

          <Text style={{ ...text, fontSize: '12px', color: '#64748B', marginTop: '20px' }}>
            For your security, please do not share these credentials. If you
            didn&apos;t expect this email, contact our team immediately.
          </Text>
        </Section>
        <Text style={footer}>
          Questions? Just reply to this email — we&apos;re here to help.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TeacherCredentialsEmail,
  subject: `Your ${SITE_NAME} teacher login credentials`,
  displayName: 'Teacher credentials',
  previewData: {
    name: 'Garima Kanwar',
    email: 'teacher@example.com',
    tempPassword: 'TempPass123!',
    loginUrl: 'https://arke.pro/login',
  },
} satisfies TemplateEntry
