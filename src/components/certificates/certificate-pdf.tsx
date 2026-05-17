import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

interface Props {
  id: string;
  courseTitle: string;
  learnerName: string;
  completedAt: Date;
  hasQuiz: boolean;
  logoBuffer?: Buffer | null;
}

const C = {
  navy: "#1B2E4B",
  gold: "#C9A84C",
  gray: "#E8E8E8",
  lightGray: "#8E8E93",
  midGray: "#5A5A6A",
  darkText: "#3C3C43",
  green: "#2E6B3E",
  greenBg: "#EAF5EE",
  greenBorder: "#A8D4B4",
};

const s = StyleSheet.create({
  page: {
    backgroundColor: C.gray,
    size: "A4",
  },
  // Outer navy border wrapper
  outerBorder: {
    flex: 1,
    borderWidth: 5,
    borderColor: C.navy,
    borderStyle: "solid",
  },
  // Gold inner border wrapper
  innerBorder: {
    flex: 1,
    margin: 9,
    borderWidth: 1.5,
    borderColor: C.gold,
    borderStyle: "solid",
  },
  // Row layout inside inner border
  row: {
    flex: 1,
    flexDirection: "row",
    margin: 5,
  },
  band: {
    width: 13,
    backgroundColor: C.navy,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  logo: {
    position: "absolute",
    top: 18,
    left: 16,
    maxHeight: 30,
    maxWidth: 90,
    objectFit: "contain",
  },
  overline: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.gold,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 7,
    textAlign: "center",
  },
  divider: {
    width: 180,
    height: 1,
    backgroundColor: C.gold,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 9,
    color: C.midGray,
    marginBottom: 7,
    textAlign: "center",
  },
  name: {
    fontSize: 27,
    fontFamily: "Times-Bold",
    color: C.navy,
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  nameLine: {
    width: 220,
    height: 1,
    backgroundColor: C.gold,
    marginBottom: 9,
  },
  courseLabel: {
    fontSize: 8,
    color: C.lightGray,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 5,
    textAlign: "center",
  },
  courseTitle: {
    fontSize: 17,
    fontFamily: "Times-Bold",
    color: C.navy,
    textAlign: "center",
    maxWidth: 380,
    marginBottom: 14,
    lineHeight: 1.3,
  },
  footerRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  evalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.greenBg,
    borderWidth: 0.5,
    borderColor: C.greenBorder,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  evalText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.green,
  },
  dateText: {
    fontSize: 8,
    color: C.lightGray,
    textAlign: "right",
  },
  dateStrong: {
    fontFamily: "Helvetica-Bold",
    color: C.darkText,
  },
  certId: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.darkText,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: 2,
  },
});

export function CertificatePDF({ id, courseTitle, learnerName, completedAt, hasQuiz, logoBuffer }: Props) {
  const dateStr = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(new Date(completedAt));

  const logoSrc = logoBuffer
    ? `data:image/png;base64,${logoBuffer.toString("base64")}`
    : null;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.outerBorder}>
          <View style={s.innerBorder}>
            <View style={s.row}>
              {/* Left navy band */}
              <View style={s.band} />

              {/* Main content */}
              <View style={s.body}>
                {logoSrc && <Image src={logoSrc} style={s.logo} />}

                <Text style={s.overline}>Certificat de reussite</Text>
                <View style={s.divider} />
                <Text style={s.subtitle}>Ce document atteste que</Text>

                <Text style={s.name}>{learnerName}</Text>
                <View style={s.nameLine} />

                <Text style={s.courseLabel}>a complete avec succes le cours</Text>
                <Text style={s.courseTitle}>{courseTitle}</Text>

                <View style={s.footerRow}>
                  {hasQuiz ? (
                    <View style={s.evalBadge}>
                      <Text style={s.evalText}>Sanctionne par une evaluation des connaissances</Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  <Text style={s.dateText}>
                    {"Delivre le  "}<Text style={s.dateStrong}>{dateStr}</Text>
                  </Text>
                </View>

                <Text style={s.certId}>N deg  {id.toUpperCase()}</Text>
              </View>

              {/* Right navy band */}
              <View style={s.band} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
