"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanDoc = cleanDoc;
exports.cleanDocs = cleanDocs;
function cleanDoc(doc) {
    if (!doc)
        return doc;
    const source = doc;
    const obj = typeof source.toObject === 'function' ? source.toObject() : { ...source };
    delete obj._id;
    delete obj.__v;
    return obj;
}
function cleanDocs(docs) {
    return docs.map(cleanDoc);
}
