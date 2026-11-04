// node_modules/fast-equals/dist/es/index.mjs
var { getOwnPropertyNames, getOwnPropertySymbols } = Object;
var { hasOwnProperty } = Object.prototype;
/**
* Combine two comparators into a single comparators.
*/
function combineComparators(comparatorA, comparatorB) {
	return function isEqual(a, b, state) {
		return comparatorA(a, b, state) && comparatorB(a, b, state);
	};
}
/**
* Wrap the provided `areItemsEqual` method to manage the circular state, allowing
* for circular references to be safely included in the comparison without creating
* stack overflows.
*/
function createIsCircular(areItemsEqual) {
	return function isCircular(a, b, state) {
		if (!a || !b || typeof a !== "object" || typeof b !== "object") return areItemsEqual(a, b, state);
		const { cache } = state;
		const cachedA = cache.get(a);
		const cachedB = cache.get(b);
		if (cachedA && cachedB) return cachedA === b && cachedB === a;
		cache.set(a, b);
		cache.set(b, a);
		const result = areItemsEqual(a, b, state);
		cache.delete(a);
		cache.delete(b);
		return result;
	};
}
/**
* Get the `@@toStringTag` of the value, if it exists.
*/
function getShortTag(value) {
	return value != null ? value[Symbol.toStringTag] : void 0;
}
/**
* Get the properties to strictly examine, which include both own properties that are
* not enumerable and symbol properties.
*/
function getStrictProperties(object) {
	return getOwnPropertyNames(object).concat(getOwnPropertySymbols(object));
}
/**
* Whether the object contains the property passed as an own property.
*/
var hasOwn = Object.hasOwn || ((object, property) => hasOwnProperty.call(object, property));
/**
* Whether the values passed are strictly equal or both NaN.
*/
function sameValueZeroEqual(a, b) {
	return a === b || !a && !b && a !== a && b !== b;
}
var PREACT_VNODE = "__v";
var PREACT_OWNER = "__o";
var REACT_OWNER = "_owner";
/**
* Above this many keys, out-of-position keys are checked with `propertyIsEnumerable` rather than by
* scanning the other object's keys. Measured in V8: scanning wins up to 50 keys and loses from 100.
*/
var MAX_SCANNED_PROPERTIES = 64;
var { getOwnPropertyDescriptor, keys } = Object;
var { propertyIsEnumerable } = Object.prototype;
/**
* Identify the element type of TypedArrays across realms and subclasses.
*/
var getTypedArrayTag = getOwnPropertyDescriptor(Object.getPrototypeOf(Int8Array.prototype), Symbol.toStringTag).get;
/**
* Whether the array buffers are equal in value.
*/
function areArrayBuffersEqual(a, b) {
	return a.byteLength === b.byteLength && areTypedArraysEqual(new Uint8Array(a), new Uint8Array(b));
}
/**
* Whether the arrays are equal in value.
*/
function areArraysEqual(a, b, state) {
	let index = a.length;
	if (b.length !== index) return false;
	while (index-- > 0) if (!state.equals(a[index], b[index], index, index, a, b, state)) return false;
	return true;
}
/**
* Whether the dataviews are equal in value.
*/
function areDataViewsEqual(a, b) {
	return a.byteLength === b.byteLength && areTypedArraysEqual(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
}
/**
* Whether the dates passed are equal in value.
*/
function areDatesEqual(a, b) {
	return sameValueZeroEqual(a.getTime(), b.getTime());
}
/**
* Whether the errors passed are equal in value.
*
* @note
* `name`, `message` and `stack` are own properties but are not enumerable, so they are compared
* explicitly. `cause` and `errors` are compared by value rather than by reference, matching how
* every other nested value in the comparison is treated. They are compared exactly once, regardless
* of whether they were assigned (enumerable) or set by the constructor (non-enumerable). Other own
* enumerable properties (which custom `Error` subclasses commonly add) are compared afterward.
*
* The own property comparison is inlined rather than extracted, which measured faster in V8 when
* recursing through `cause`. Keep the bytecode under V8's 460-byte TurboFan inlining limit (383 bytes
* at time of writing; check with `node --print-bytecode --print-bytecode-filter=areErrorsEqual`), or
* this stops being inlined into its callers.
*/
function areErrorsEqual(a, b, state) {
	if (a.name !== b.name || a.message !== b.message || a.stack !== b.stack) return false;
	const causeA = a.cause;
	const causeB = b.cause;
	if (causeA !== causeB && !state.equals(causeA, causeB, "cause", "cause", a, b, state)) return false;
	const errorsA = a.errors;
	const errorsB = b.errors;
	if (errorsA !== errorsB && !state.equals(errorsA, errorsB, "errors", "errors", a, b, state)) return false;
	const propertiesA = keys(a);
	const propertiesB = keys(b);
	let index = propertiesA.length;
	if (!index && !propertiesB.length) return true;
	let compared = 0;
	let property;
	while (index-- > 0) {
		property = propertiesA[index];
		if (property === "cause" || property === "errors") continue;
		if (property !== propertiesB[index] && !propertyIsEnumerable.call(b, property) || !state.equals(a[property], b[property], property, property, a, b, state)) return false;
		++compared;
	}
	const remaining = propertiesB.length - compared;
	return !remaining || remaining === (propertyIsEnumerable.call(b, "cause") ? 1 : 0) + (propertyIsEnumerable.call(b, "errors") ? 1 : 0);
}
/**
* Whether the functions passed are equal in value.
*/
function areFunctionsEqual(a, b) {
	return a === b;
}
/**
* Whether the errors passed are equal in value.
*
* @note
* `name`, `message` and `stack` are own properties but are not enumerable, so they are compared
* explicitly. `cause` and `errors` are own properties, so `areObjectsEqualStrict` compares them along
* with every other own property; they are not compared explicitly to avoid comparing them twice.
*/
function areErrorsEqualStrict(a, b, state) {
	return a.name === b.name && a.message === b.message && a.stack === b.stack && areObjectsEqualStrict(a, b, state);
}
/**
* Whether the `Map`s are equal in value.
*/
function areMapsEqual(a, b, state) {
	const size = a.size;
	if (size !== b.size) return false;
	if (!size) return true;
	const matchedIndices = new Array(size);
	const aIterable = a.entries();
	let aResult;
	let bResult;
	let index = 0;
	while (aResult = aIterable.next()) {
		if (aResult.done) break;
		const bIterable = b.entries();
		let hasMatch = false;
		let matchIndex = 0;
		while (bResult = bIterable.next()) {
			if (bResult.done) break;
			if (matchedIndices[matchIndex]) {
				matchIndex++;
				continue;
			}
			const aEntry = aResult.value;
			const bEntry = bResult.value;
			if (state.equals(aEntry[0], bEntry[0], index, matchIndex, a, b, state) && state.equals(aEntry[1], bEntry[1], aEntry[0], bEntry[0], a, b, state)) {
				hasMatch = matchedIndices[matchIndex] = true;
				break;
			}
			matchIndex++;
		}
		if (!hasMatch) return false;
		index++;
	}
	return true;
}
/**
* Whether the numbers are equal in value.
*/
var areNumbersEqual = sameValueZeroEqual;
/**
* Whether the objects are equal in value.
*/
function areObjectsEqual(a, b, state) {
	const properties = keys(a);
	const propertiesB = keys(b);
	let index = properties.length;
	if (propertiesB.length !== index) return false;
	const isScannable = index <= MAX_SCANNED_PROPERTIES;
	let property;
	while (index-- > 0) {
		property = properties[index];
		if (isReactProperty(a, b, property)) continue;
		if (property !== propertiesB[index] && !(isScannable ? propertiesB.includes(property) : propertyIsEnumerable.call(b, property)) || !state.equals(a[property], b[property], property, property, a, b, state)) return false;
	}
	return true;
}
/**
* Whether the objects are equal in value with strict property checking.
*/
function areObjectsEqualStrict(a, b, state) {
	const properties = getStrictProperties(a);
	let index = properties.length;
	if (getStrictProperties(b).length !== index) return false;
	let property;
	let descriptorA;
	let descriptorB;
	while (index-- > 0) {
		property = properties[index];
		if (!isReactProperty(a, b, property) && (!hasOwn(b, property) || !state.equals(a[property], b[property], property, property, a, b, state))) return false;
		descriptorA = getOwnPropertyDescriptor(a, property);
		descriptorB = getOwnPropertyDescriptor(b, property);
		if ((descriptorA || descriptorB) && (!descriptorA || !descriptorB || descriptorA.configurable !== descriptorB.configurable || descriptorA.enumerable !== descriptorB.enumerable || descriptorA.writable !== descriptorB.writable)) return false;
	}
	return true;
}
/**
* Whether the primitive wrappers passed are equal in value.
*/
function arePrimitiveWrappersEqual(a, b) {
	return sameValueZeroEqual(a.valueOf(), b.valueOf());
}
/**
* Whether the regexps passed are equal in value.
*/
function areRegExpsEqual(a, b) {
	return a.source === b.source && a.flags === b.flags;
}
/**
* Whether the `Set`s are equal in value.
*/
function areSetsEqual(a, b, state) {
	const size = a.size;
	if (size !== b.size) return false;
	if (!size) return true;
	const matchedIndices = new Array(size);
	const aIterable = a.values();
	let aResult;
	let bResult;
	while (aResult = aIterable.next()) {
		if (aResult.done) break;
		const bIterable = b.values();
		let hasMatch = false;
		let matchIndex = 0;
		while (bResult = bIterable.next()) {
			if (bResult.done) break;
			if (!matchedIndices[matchIndex] && state.equals(aResult.value, bResult.value, aResult.value, bResult.value, a, b, state)) {
				hasMatch = matchedIndices[matchIndex] = true;
				break;
			}
			matchIndex++;
		}
		if (!hasMatch) return false;
	}
	return true;
}
/**
* Whether the TypedArray instances are equal in value.
*/
function areTypedArraysEqual(a, b) {
	let index = a.length;
	if (b.length !== index || a.byteOffset !== b.byteOffset) return false;
	const tag = getTypedArrayTag.call(a);
	if (tag === "Float64Array" || tag === "Float32Array" || tag === "Float16Array") {
		while (index-- > 0) if (a[index] !== b[index] && (a[index] === a[index] || b[index] === b[index])) return false;
		return true;
	}
	while (index-- > 0) if (a[index] !== b[index]) return false;
	return true;
}
/**
* Whether the URL instances are equal in value.
*/
function areUrlsEqual(a, b) {
	if (a.href === b.href) return true;
	return a.protocol === b.protocol && a.username === b.username && a.password === b.password && a.host === b.host && a.pathname === b.pathname && a.hash === b.hash && areSearchParamsEqual(a.searchParams, b.searchParams);
}
/**
* Whether the search params passed are equal in value.
*
* @note
* Order is not significant, matching how the other unordered collections in the library are
* compared. Repeated keys are, so this is a comparison of multisets rather than of sets:
* `a=1&a=2` is equal to `a=2&a=1`, but not to `a=1&a=1`.
*/
function areSearchParamsEqual(a, b) {
	const serializedA = a.toString();
	const serializedB = b.toString();
	return serializedA === serializedB || sortSearchParams(serializedA) === sortSearchParams(serializedB);
}
/**
* Reorder a serialized query string so that params holding the same pairs compare as equal
* regardless of the order they appear in.
*
* @note
* The serializer percent-encodes `&` and `=` wherever they appear inside a name or a value, so
* splitting on `&` recovers exactly the pairs and nothing else.
*/
function sortSearchParams(serialized) {
	return serialized.split("&").sort().join("&");
}
function isReactProperty(a, b, property) {
	return (property === REACT_OWNER || property === PREACT_OWNER || property === PREACT_VNODE) && !!(a.$$typeof || b.$$typeof);
}
var ARRAY_BUFFER_TAG = "[object ArrayBuffer]";
var ARGUMENTS_TAG = "[object Arguments]";
var BOOLEAN_TAG = "[object Boolean]";
var DATA_VIEW_TAG = "[object DataView]";
var DATE_TAG = "[object Date]";
var ERROR_TAG = "[object Error]";
var MAP_TAG = "[object Map]";
var NUMBER_TAG = "[object Number]";
var OBJECT_TAG = "[object Object]";
var REG_EXP_TAG = "[object RegExp]";
var SET_TAG = "[object Set]";
var STRING_TAG = "[object String]";
var TYPED_ARRAY_TAGS = {
	"[object Int8Array]": true,
	"[object Uint8Array]": true,
	"[object Uint8ClampedArray]": true,
	"[object Int16Array]": true,
	"[object Uint16Array]": true,
	"[object Int32Array]": true,
	"[object Uint32Array]": true,
	"[object Float16Array]": true,
	"[object Float32Array]": true,
	"[object Float64Array]": true,
	"[object BigInt64Array]": true,
	"[object BigUint64Array]": true
};
var URL_TAG = "[object URL]";
var toString = Object.prototype.toString;
/**
* Create a comparator method based on the type-specific equality comparators passed.
*/
function createEqualityComparator({ areArrayBuffersEqual, areArraysEqual, areDataViewsEqual, areDatesEqual, areErrorsEqual, areFunctionsEqual, areMapsEqual, areNumbersEqual, areObjectsEqual, arePrimitiveWrappersEqual, areRegExpsEqual, areSetsEqual, areTypedArraysEqual, areUrlsEqual, unknownTagComparators }) {
	/**
	* compare the value of the two objects and return true if they are equivalent in values
	*/
	return function comparator(a, b, state) {
		if (a === b) return true;
		if (a == null || b == null) return false;
		const type = typeof a;
		if (type !== typeof b) return false;
		if (type !== "object") {
			if (type === "number") return areNumbersEqual(a, b, state);
			if (type === "function") return areFunctionsEqual(a, b, state);
			return false;
		}
		const constructor = a.constructor;
		if (constructor !== b.constructor) return false;
		if (constructor === Object) return areObjectsEqual(a, b, state);
		if (Array.isArray(a)) return areArraysEqual(a, b, state);
		if (constructor === Date) return areDatesEqual(a, b, state);
		if (constructor === RegExp) return areRegExpsEqual(a, b, state);
		if (constructor === Map) return areMapsEqual(a, b, state);
		if (constructor === Set) return areSetsEqual(a, b, state);
		if (constructor == null) return areObjectsEqual(a, b, state);
		const tag = toString.call(a);
		if (tag === DATE_TAG) return areDatesEqual(a, b, state);
		if (tag === REG_EXP_TAG) return areRegExpsEqual(a, b, state);
		if (tag === MAP_TAG) return areMapsEqual(a, b, state);
		if (tag === SET_TAG) return areSetsEqual(a, b, state);
		if (tag === OBJECT_TAG) return typeof a.then !== "function" && typeof b.then !== "function" && areObjectsEqual(a, b, state);
		if (tag === URL_TAG) return areUrlsEqual(a, b, state);
		if (tag === ERROR_TAG) return areErrorsEqual(a, b, state);
		if (tag === ARGUMENTS_TAG) return areObjectsEqual(a, b, state);
		if (TYPED_ARRAY_TAGS[tag]) return areTypedArraysEqual(a, b, state);
		if (tag === ARRAY_BUFFER_TAG) return areArrayBuffersEqual(a, b, state);
		if (tag === DATA_VIEW_TAG) return areDataViewsEqual(a, b, state);
		if (tag === BOOLEAN_TAG || tag === NUMBER_TAG || tag === STRING_TAG) return arePrimitiveWrappersEqual(a, b, state);
		if (unknownTagComparators) {
			let unknownTagComparator = unknownTagComparators[tag];
			if (!unknownTagComparator) {
				const shortTag = getShortTag(a);
				if (shortTag) unknownTagComparator = unknownTagComparators[shortTag];
			}
			if (unknownTagComparator) return unknownTagComparator(a, b, state);
		}
		return false;
	};
}
/**
* Create the configuration object used for building comparators.
*/
function createEqualityComparatorConfig({ circular, createCustomConfig, strict }) {
	let config = {
		areArrayBuffersEqual,
		areArraysEqual: strict ? areObjectsEqualStrict : areArraysEqual,
		areDataViewsEqual,
		areDatesEqual,
		areErrorsEqual: strict ? areErrorsEqualStrict : areErrorsEqual,
		areFunctionsEqual,
		areMapsEqual: strict ? combineComparators(areMapsEqual, areObjectsEqualStrict) : areMapsEqual,
		areNumbersEqual,
		areObjectsEqual: strict ? areObjectsEqualStrict : areObjectsEqual,
		arePrimitiveWrappersEqual,
		areRegExpsEqual,
		areSetsEqual: strict ? combineComparators(areSetsEqual, areObjectsEqualStrict) : areSetsEqual,
		areTypedArraysEqual: strict ? combineComparators(areTypedArraysEqual, areObjectsEqualStrict) : areTypedArraysEqual,
		areUrlsEqual,
		unknownTagComparators: void 0
	};
	if (createCustomConfig) config = Object.assign({}, config, createCustomConfig(config));
	if (circular) {
		const areArraysEqual = createIsCircular(config.areArraysEqual);
		const areErrorsEqual = createIsCircular(config.areErrorsEqual);
		const areMapsEqual = createIsCircular(config.areMapsEqual);
		const areObjectsEqual = createIsCircular(config.areObjectsEqual);
		const areSetsEqual = createIsCircular(config.areSetsEqual);
		config = Object.assign({}, config, {
			areArraysEqual,
			areErrorsEqual,
			areMapsEqual,
			areObjectsEqual,
			areSetsEqual
		});
	}
	return config;
}
/**
* Default equality comparator pass-through, used as the standard `isEqual` creator for
* use inside the built comparator.
*/
function createInternalEqualityComparator(compare) {
	return function(a, b, _indexOrKeyA, _indexOrKeyB, _parentA, _parentB, state) {
		return compare(a, b, state);
	};
}
/**
* Create the `isEqual` function used by the consuming application.
*/
function createIsEqual({ circular, comparator, createState, equals, strict }) {
	if (createState) return function isEqual(a, b) {
		const { cache = circular ? /* @__PURE__ */ new WeakMap() : void 0, meta } = createState();
		return comparator(a, b, {
			cache,
			equals,
			meta,
			strict
		});
	};
	if (circular) return function isEqual(a, b) {
		return comparator(a, b, {
			cache: /* @__PURE__ */ new WeakMap(),
			equals,
			meta: void 0,
			strict
		});
	};
	const state = {
		cache: void 0,
		equals,
		meta: void 0,
		strict
	};
	return function isEqual(a, b) {
		return comparator(a, b, state);
	};
}
/**
* Whether the items passed are deeply-equal in value.
*/
var deepEqual = createCustomEqual();
createCustomEqual({ strict: true });
createCustomEqual({ circular: true });
createCustomEqual({
	circular: true,
	strict: true
});
createCustomEqual({ createInternalComparator: () => sameValueZeroEqual });
createCustomEqual({
	strict: true,
	createInternalComparator: () => sameValueZeroEqual
});
createCustomEqual({
	circular: true,
	createInternalComparator: () => sameValueZeroEqual
});
createCustomEqual({
	circular: true,
	createInternalComparator: () => sameValueZeroEqual,
	strict: true
});
/**
* Create a custom equality comparison method.
*
* This can be done to create very targeted comparisons in extreme hot-path scenarios
* where the standard methods are not performant enough, but can also be used to provide
* support for legacy environments that do not support expected features like
* `RegExp.prototype.flags` out of the box.
*/
function createCustomEqual(options = {}) {
	const { circular = false, createInternalComparator: createCustomInternalComparator, createState, strict = false } = options;
	const comparator = createEqualityComparator(createEqualityComparatorConfig(options));
	return createIsEqual({
		circular,
		comparator,
		createState,
		equals: createCustomInternalComparator ? createCustomInternalComparator(comparator) : createInternalEqualityComparator(comparator),
		strict
	});
}
export { deepEqual as t };
