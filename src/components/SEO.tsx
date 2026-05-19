import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
}

const SITE = "ARKE Scholars";
const BASE_URL = "https://arkescholars.com";

export default function SEO({ title, description, canonical }: SEOProps) {
  const full = `${title} | ${SITE}`;
  const url = canonical ? `${BASE_URL}${canonical}` : undefined;
  return (
    <Helmet>
      <title>{full}</title>
      <meta name="description" content={description} />
      {url && <link rel="canonical" href={url} />}
      <meta property="og:title" content={full} />
      <meta property="og:description" content={description} />
      {url && <meta property="og:url" content={url} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={full} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
