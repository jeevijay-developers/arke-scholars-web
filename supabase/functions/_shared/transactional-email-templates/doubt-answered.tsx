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
  text,
} from './_styles.ts'

interface Props {
  studentName?: string
  subject?: string
  questionPreview?: string
  answeredBy?: string
  appUrl?: string
}

const DoubtAnsweredEmail = ({
  studentName,
  subject = 'your doubt',
  questionPreview,
  answeredBy = 'your teacher',
  appUrl = 'https://arke.pro',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {subject} doubt has been answered</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{SITE_NAME}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {studentName ? `Hi ${studentName},` : 'Good news!'}
          </Heading>
          <Text style={text}>
            {answeredBy} just posted an answer to your <strong>{subject}</strong> doubt.
          </Text>
          {questionPreview && (
            <>
              <div style={divider} />
              <Text style={label}>Your question</Text>
              <Text style={{ ...text, fontStyle: 'italic', color: '#1E293B' }}>
                &ldquo;{questionPreview}&rdquo;
              </Text>
            </>
          )}
          <Button href={`${appUrl}/doubts`} style={button}>
            View answer
          </Button>
        </Section>
        <Text style={footer}>
          Keep asking — every doubt cleared brings you closer to your goal.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DoubtAnsweredEmail,
  subject: (data: Record<string, any>) =>
    `Your ${data.subject || 'doubt'} has been answered on ${SITE_NAME}`,
  displayName: 'Doubt answered',
  previewData: {
    studentName: 'Aanya',
    subject: 'Physics',
    questionPreview: 'How does projectile motion work for inclined surfaces?',
    answeredBy: 'Vikram Thapar',
  },
} satisfies TemplateEntry
