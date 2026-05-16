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
  recipientName?: string
  senderName?: string
  messagePreview?: string
  chatUrl?: string
}

const MentorMessageEmail = ({
  recipientName,
  senderName = 'Your mentor',
  messagePreview,
  chatUrl = 'https://arke.pro/mentor-chat',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{senderName} sent you a new message</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{SITE_NAME}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {recipientName ? `Hi ${recipientName},` : 'New message for you'}
          </Heading>
          <Text style={text}>
            <strong>{senderName}</strong> just sent you a message.
          </Text>
          {messagePreview && (
            <>
              <div style={divider} />
              <Text style={label}>Message preview</Text>
              <Text style={{ ...text, color: '#1E293B' }}>
                &ldquo;{messagePreview}&rdquo;
              </Text>
            </>
          )}
          <Button href={chatUrl} style={button}>
            Reply now
          </Button>
        </Section>
        <Text style={footer}>
          You&apos;re receiving this because you have an active mentor connection on {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MentorMessageEmail,
  subject: (data: Record<string, any>) =>
    `New message from ${data.senderName || 'your mentor'}`,
  displayName: 'Mentor message',
  previewData: {
    recipientName: 'Aanya',
    senderName: 'Kavitha Menon',
    messagePreview: 'Great progress this week! Let&apos;s plan your revision schedule.',
  },
} satisfies TemplateEntry
