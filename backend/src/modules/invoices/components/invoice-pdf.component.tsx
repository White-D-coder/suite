import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'column',
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  companyDetails: {
    fontSize: 9,
    color: '#666666',
    marginTop: 4,
    lineHeight: 1.4,
  },
  invoiceTitleContainer: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  metaInfo: {
    fontSize: 9,
    marginTop: 4,
    textAlign: 'right',
    lineHeight: 1.4,
  },
  metaLabel: {
    fontWeight: 'bold',
    color: '#475569',
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  billTo: {
    width: '45%',
  },
  shipTo: {
    width: '45%',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 4,
  },
  infoText: {
    lineHeight: 1.5,
  },
  infoName: {
    fontWeight: 'bold',
    fontSize: 11,
    color: '#1e293b',
    marginBottom: 2,
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontWeight: 'bold',
    color: '#475569',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  colDesc: { width: '55%' },
  colQty: { width: '10%', textAlign: 'center' },
  colPrice: { width: '15%', textAlign: 'right' },
  colTotal: { width: '20%', textAlign: 'right' },
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  totalsTable: {
    width: '35%',
    fontSize: 10,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    marginTop: 6,
    fontWeight: 'bold',
    fontSize: 12,
  },
  notesContainer: {
    marginTop: 40,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8,
    color: '#64748b',
    lineHeight: 1.4,
  },
});

interface InvoicePDFProps {
  invoice: any;
  company: any;
  client: any;
  templateContent?: string; // fallback or customized values
}

export const InvoicePDF: React.FC<InvoicePDFProps> = ({ invoice, company, client }) => {
  const currency = invoice.currency || 'USD';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.companyName}>{company?.companyName || 'My Digital Agency'}</Text>
            <Text style={styles.companyDetails}>
              Premium Client Services & Custom Digital Engineering
            </Text>
          </View>
          <View style={styles.invoiceTitleContainer}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.metaInfo}>
              <Text>
                <Text style={styles.metaLabel}>Invoice No: </Text>
                {invoice.invoiceNumber}
              </Text>
              <Text>
                <Text style={styles.metaLabel}>Issue Date: </Text>
                {new Date(invoice.issueDate).toLocaleDateString()}
              </Text>
              {invoice.dueDate && (
                <Text>
                  <Text style={styles.metaLabel}>Due Date: </Text>
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.detailsContainer}>
          <View style={styles.billTo}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <View style={styles.infoText}>
              <Text style={styles.infoName}>{client.name}</Text>
              {client.company && <Text>{client.company}</Text>}
              {client.email && <Text>{client.email}</Text>}
              {client.phone && <Text>{client.phone}</Text>}
              {client.billingAddress && <Text>{client.billingAddress}</Text>}
            </View>
          </View>
          <View style={styles.shipTo}>
            <Text style={styles.sectionTitle}>Terms</Text>
            <View style={styles.infoText}>
              <Text>
                <Text style={styles.metaLabel}>Payment Terms: </Text>
                {client.paymentTerms || 'Due on Receipt'}
              </Text>
              <Text>
                <Text style={styles.metaLabel}>Currency: </Text>
                {currency}
              </Text>
            </View>
          </View>
        </View>

        {/* Table Section */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Rate</Text>
            <Text style={styles.colTotal}>Amount</Text>
          </View>

          {invoice.lineItems.map((item: any, index: number) => (
            <View key={item.id || index} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>
                {Number(item.unitPrice).toFixed(2)}
              </Text>
              <Text style={styles.colTotal}>
                {Number(item.total).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals Section */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.metaLabel}>Subtotal</Text>
              <Text>{Number(invoice.subtotal).toFixed(2)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.metaLabel}>Tax ({Number(invoice.taxRate)}%)</Text>
              <Text>{Number(invoice.taxAmount).toFixed(2)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text>Total ({currency})</Text>
              <Text>{Number(invoice.total).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Notes/Footer Section */}
        <View style={styles.notesContainer}>
          <Text style={styles.notesTitle}>Payment Instructions</Text>
          <Text style={styles.notesText}>
            Please include invoice number {invoice.invoiceNumber} in bank transfer details. Standard payments are processed through ACH, Wire, or Credit Card based on the client payment terms. For any billing questions, contact accounting@agency.com.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
