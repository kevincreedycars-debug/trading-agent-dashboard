"use strict";

/**
 * Minimal structural validator for the research-card schema (docs/research/usd-session/v1/research-card.schema.json).
 *
 * Node's built-in test runner is the only framework in this repository and there is no JSON-schema
 * dependency in package.json, so this implements the subset of draft 2020-12 the card schema actually
 * uses: type, enum, const, required, additionalProperties, properties, items, minItems, minLength,
 * pattern, format: date. It exists so a generated card cannot be handed to a researcher or cited by the
 * engine specification while malformed.
 */

const SCHEMA_ERROR = "ResearchCardSchemaError";

class ResearchCardSchemaError extends Error {
  constructor(errors) {
    super(`research card failed schema validation: ${errors.join("; ")}`);
    this.name = SCHEMA_ERROR;
    this.errors = errors;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value, type) {
  switch (type) {
    case "object": return typeOf(value) === "object";
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "boolean": return typeof value === "boolean";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return Number.isInteger(value);
    default: return false;
  }
}

function validateNode(node, schema, path, errors) {
  const here = path || "(root)";

  if (schema.const !== undefined && node !== schema.const) {
    errors.push(`${here} must equal ${JSON.stringify(schema.const)}`);
    return;
  }
  if (schema.enum && !schema.enum.some((candidate) => candidate === node)) {
    errors.push(`${here} must be one of ${schema.enum.join(", ")}`);
    return;
  }
  const types = schema.type === undefined ? null : [].concat(schema.type);
  if (types && !types.some((type) => matchesType(node, type))) {
    errors.push(`${here} must be ${types.join(" or ")} (found ${typeOf(node)})`);
    return;
  }
  if (typeof node === "string") {
    if (schema.minLength !== undefined && node.length < schema.minLength) {
      errors.push(`${here} shorter than minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(node)) {
      errors.push(`${here} does not match pattern ${schema.pattern}`);
    }
    if (schema.format === "date" && !DATE_RE.test(node)) {
      errors.push(`${here} must be an ISO date (YYYY-MM-DD)`);
    }
  }
  if (Array.isArray(node)) {
    if (schema.minItems !== undefined && node.length < schema.minItems) {
      errors.push(`${here} needs at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      node.forEach((item, index) => validateNode(item, schema.items, `${here}[${index}]`, errors));
    }
  }
  if (node && typeOf(node) === "object") {
    const properties = schema.properties || {};
    for (const required of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(node, required)) {
        errors.push(`${here} missing required property ${required}`);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        validateNode(value, properties[key], `${here}.${key}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${here} has undeclared property ${key}`);
      }
    }
  }
}

/** Return `{ ok, errors }` without throwing. */
function checkResearchCard(card, schema) {
  const errors = [];
  validateNode(card, schema, "", errors);
  return { ok: errors.length === 0, errors };
}

/** Throw a `ResearchCardSchemaError` naming every violation. */
function assertResearchCard(card, schema) {
  const result = checkResearchCard(card, schema);
  if (!result.ok) throw new ResearchCardSchemaError(result.errors);
  return card;
}

module.exports = { ResearchCardSchemaError, checkResearchCard, assertResearchCard };
