"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createId = createId;
const crypto_1 = __importDefault(require("crypto"));
function createId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${crypto_1.default.randomBytes(3).toString('hex')}`;
}
