import { createHash } from 'crypto';

const JSZip: typeof import('jszip') = require('jszip');

export type WpsCellImage = {
  id: string;
  buffer: Buffer;
  widthPx: number;
  heightPx: number;
};

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const EMU_PER_PIXEL = 9525;

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function insertBeforeClosingTag(xml: string, closingTag: string, content: string): string {
  const index = xml.lastIndexOf(closingTag);
  if (index < 0) throw new Error(`Invalid XLSX XML: missing ${closingTag}`);
  return `${xml.slice(0, index)}${content}${xml.slice(index)}`;
}

function getNextRelationshipId(xml: string): string {
  const ids = Array.from(xml.matchAll(/\bId="rId(\d+)"/g), (match) => Number(match[1]));
  return `rId${Math.max(0, ...ids) + 1}`;
}

function normalizeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 160;
}

function buildCellImagesXml(images: WpsCellImage[]): string {
  const imageElements = images.map((image, index) => {
    const relationshipId = `rId${index + 1}`;
    const widthEmu = normalizeDimension(image.widthPx) * EMU_PER_PIXEL;
    const heightEmu = normalizeDimension(image.heightPx) * EMU_PER_PIXEL;
    return [
      '<etc:cellImage><xdr:pic><xdr:nvPicPr>',
      `<xdr:cNvPr id="${index + 1}" name="${escapeXmlAttribute(image.id)}"/>`,
      '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>',
      '</xdr:nvPicPr><xdr:blipFill>',
      `<a:blip r:embed="${relationshipId}"/>`,
      '<a:stretch><a:fillRect/></a:stretch>',
      '</xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/>',
      `<a:ext cx="${widthEmu}" cy="${heightEmu}"/>`,
      '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>',
      '<a:noFill/><a:ln w="9525"><a:noFill/></a:ln>',
      '</xdr:spPr></xdr:pic></etc:cellImage>',
    ].join('');
  }).join('');
  return `${XML_DECLARATION}<etc:cellImages xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:etc="http://www.wps.cn/officeDocument/2017/etCustomData">${imageElements}</etc:cellImages>`;
}

function buildCellImagesRelationshipsXml(images: WpsCellImage[]): string {
  const relationships = images.map((_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/cellimage${index + 1}.png"/>`
  )).join('');
  return `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`;
}

export function createWpsCellImageId(buffer: Buffer): string {
  const digest = createHash('md5').update(buffer).digest('hex').toUpperCase();
  return `ID_${digest}`;
}

export function createWpsCellImageFormula(imageId: string): {
  formula: string;
  result: string;
} {
  const escapedId = imageId.replace(/"/g, '');
  return {
    formula: `_xlfn.DISPIMG("${escapedId}",1)`,
    result: `=DISPIMG("${escapedId}",1)`,
  };
}

export async function embedWpsCellImages(
  workbookBuffer: Buffer,
  images: WpsCellImage[],
): Promise<Buffer> {
  if (images.length === 0) return workbookBuffer;

  const zip = await JSZip.loadAsync(workbookBuffer);
  const contentTypesFile = zip.file('[Content_Types].xml');
  const workbookRelationshipsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!contentTypesFile || !workbookRelationshipsFile) {
    throw new Error('Invalid XLSX package: workbook relationships are missing');
  }

  let contentTypesXml = await contentTypesFile.async('string');
  if (!/Extension="png"/i.test(contentTypesXml)) {
    contentTypesXml = insertBeforeClosingTag(
      contentTypesXml,
      '</Types>',
      '<Default Extension="png" ContentType="image/png"/>',
    );
  }
  if (!contentTypesXml.includes('PartName="/xl/cellimages.xml"')) {
    contentTypesXml = insertBeforeClosingTag(
      contentTypesXml,
      '</Types>',
      '<Override PartName="/xl/cellimages.xml" ContentType="application/vnd.wps-officedocument.cellimage+xml"/>',
    );
  }
  zip.file('[Content_Types].xml', contentTypesXml);

  let workbookRelationshipsXml = await workbookRelationshipsFile.async('string');
  if (!workbookRelationshipsXml.includes('http://www.wps.cn/officeDocument/2020/cellImage')) {
    const relationshipId = getNextRelationshipId(workbookRelationshipsXml);
    workbookRelationshipsXml = insertBeforeClosingTag(
      workbookRelationshipsXml,
      '</Relationships>',
      `<Relationship Id="${relationshipId}" Type="http://www.wps.cn/officeDocument/2020/cellImage" Target="cellimages.xml"/>`,
    );
  }
  zip.file('xl/_rels/workbook.xml.rels', workbookRelationshipsXml);

  zip.file('xl/cellimages.xml', buildCellImagesXml(images));
  zip.file('xl/_rels/cellimages.xml.rels', buildCellImagesRelationshipsXml(images));
  images.forEach((image, index) => {
    zip.file(`xl/media/cellimage${index + 1}.png`, image.buffer);
  });

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
