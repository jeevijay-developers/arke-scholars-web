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
  studentName?: string
  classTitle?: string
  educatorName?: string
  startsAt?: string // human-readable formatted time
  subject?: string
  joinUrl?: string
}

const LiveClassReminderEmail = ({
  studentName,
  classTitle = 'your live class',
  educatorName,
  startsAt,
  subject,
  joinUrl = 'https://arke.pro/live-classes',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{classTitle} starts soon — join from your dashboard</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{SITE_NAME}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {studentName ? `${studentName}, your class starts soon` : 'Your class starts soon'}
          </Heading>
          <Text style={text}>
            This is a friendly reminder that your live class is about to begin.
          </Text>
          <div style={divider} />
          <Text style={label}>Class</Text>
          <Text style={stat}>{classTitle}</Text>
          {educatorName && (
            <>
              <Text style={{ ...label, marginTop: '12px' }}>Educator</Text>
              <Text style={stat}>{educatorName}</Text>
            </>
          )}
          {subject && (
            <>
              <Text style={{ ...label, marginTop: '12px' }}>Subject</Text>
              <Text style={stat}>{subject}</Text>
            </>
          )}
          {startsAt && (
            <>
              <Text style={{ ...label, marginTop: '12px' }}>Starts at</Text>
              <Text style={stat}>{startsAt}</Text>
            </>
          )}
          <div style={divider} />
          <Button href={joinUrl} style={button}>
            Join class
          </Button>
        </Section>
        <Text style={footer}>
          Tip: join 2-3 minutes early to test your audio and video.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LiveClassReminderEmail,
  subject: (data: Record<string, any>) =>
    `Reminder: ${data.classTitle || 'your live class'} starts soon`,
  displayName: 'Live class reminder',
  previewData: {
    studentName: 'Aanya',
    classTitle: 'Rotational Motion — Problem Solving',
    educatorName: 'Vikram Thapar',
    subject: 'Physics',
    startsAt: 'Today, 6:00 PM IST',
  },
} satisfies TemplateEntry
