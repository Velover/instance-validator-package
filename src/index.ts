/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-mixed-spaces-and-tabs */

import CountElement from "./Utils/CountElement";

namespace InstanceValidator {
	export type PropertyValidationFunction<T, Q extends Instance> = (
		value: T,
		warning_list: string[],
		instance: Q,
		property_name: string,
	) => boolean;

	export type ChildrenValidationFunction = (
		children: Instance[],
		warning_list: string[],
	) => boolean;

	export type ChildValidatorFunction = (
		instance: Instance | undefined,
		warning_list: string[],
		name: string,
	) => boolean;

	export interface IInstanceTree<T extends keyof Instances = "Instance"> {
		ClassName?: T;
		IsOptional?: boolean;
		Properties?: {
			[key in keyof InstanceProperties<Instances[T]>]?:
				| InstanceProperties<Instances[T]>[key]
				| PropertyValidationFunction<
						InstanceProperties<Instances[T]>[key],
						Instances[T]
				  >;
		};

		Children?:
			| {
					[key: string]:
						| IInstanceTree<any>
						| keyof Instances
						| ChildValidatorFunction;
			  }
			| ChildrenValidationFunction;
	}

	export function CreateTree<T extends keyof Instances>(
		class_name: T,
		tree_data: Omit<IInstanceTree<T>, "ClassName">,
	): IInstanceTree<T> {
		return {
			ClassName: class_name,
			...tree_data,
		};
	}

	export function PropertyIsNotUndefinedValidator(
		property: unknown,
		warning_list: string[],
		instance: Instance,
		property_name: string,
	) {
		if (property === undefined) {
			warning_list.push(
				`Property ${property_name} is undefined in ${instance.GetFullName()}`,
			);
		}
		return property !== undefined;
	}

	export function CombineValidators<T extends unknown[]>(
		...callbacks: ((...args: T) => boolean)[]
	) {
		return (...args: T) => {
			let success = true;
			callbacks.forEach((callback) => {
				success = success && callback(...args);
			});
			return success;
		};
	}

	export function AllChildrenOfClassValidator(class_name: keyof Instances) {
		return (children: Instance[], warning_list: string[]) => {
			let success = true;
			children.forEach((child) => {
				if (child.IsA(class_name as never)) return;
				success = false;
				warning_list.push(
					`Child ${child.GetFullName()} should be of class ${class_name}`,
				);
			});
			return success;
		};
	}

	function SelectInstanceName(instance: Instance) {
		return instance.Name;
	}
	export function NoChildrenDuplicates(
		children: Instance[],
		warning_list: string[],
	) {
		let success = true;
		children.forEach((child) => {
			const amount = CountElement(children, child.Name, SelectInstanceName);
			if (amount <= 1) return;
			success = false;
			warning_list.push(`Duplicated child ${child.GetFullName()}`);
		});
		return success;
	}

	export function ValidateTree<T extends IInstanceTree>(
		instance: Instance,
		tree: T,
		warning_list: string[] = [],
	) {
		const instance_tree = tree as IInstanceTree;
		if (instance_tree.ClassName !== undefined) {
			if (!(instance as RunService).IsA(instance_tree.ClassName)) {
				warning_list.push(
					`Instance ${instance.GetFullName()} should be of class ${instance}`,
				);
				return false;
			}
		}

		if (instance_tree.Properties !== undefined) {
			let no_errors = true;
			// eslint-disable-next-line roblox-ts/no-array-pairs
			for (const [key, validator] of pairs(instance_tree.Properties)) {
				if (typeIs(validator, "function")) {
					const value = instance[key as never];
					if (!validator(value as never, warning_list, instance, key)) {
						warning_list.push(
							`Property ${key} of ${instance.GetFullName()} doesnt satify the validator`,
						);
						no_errors = false;
					}
					continue;
				} else if (instance[key as never] !== validator) {
					warning_list.push(
						`Property ${key} of ${instance.GetFullName()} should be of type ${typeOf(
							validator,
						)} with value ${validator}`,
					);
					no_errors = false;
				}
			}
			if (!no_errors) return false;
		}

		if (instance_tree.Children !== undefined) {
			if (typeIs(instance_tree.Children, "function")) {
				const chilren = instance.GetChildren();
				if (!instance_tree.Children(chilren, warning_list)) {
					warning_list.push(
						`Children of ${instance.GetFullName()} didnt satisfy the validator`,
					);
					return false;
				}
			} else {
				let no_errors = true;
				// eslint-disable-next-line roblox-ts/no-array-pairs
				for (const [key, validator] of pairs(instance_tree.Children)) {
					const child = instance.FindFirstChild(key);
					if (typeIs(validator, "function")) {
						if (!validator(child, warning_list, key as string)) {
							warning_list.push(
								`child ${key} of ${instance.GetFullName()} didnt satisfy the validator`,
							);
							no_errors = false;
						}
					} else if (typeIs(validator, "table")) {
						if (child === undefined && validator.IsOptional) continue;
						if (child === undefined) {
							warning_list.push(
								`Child ${key} is missing from ${instance.GetFullName()}`,
							);
							no_errors = false;
							continue;
						}
						if (!ValidateTree(child, validator, warning_list)) {
							warning_list.push(`Child ${key} doesnt satisfy the tree`);
							no_errors = false;
							continue;
						}
					} else {
						if (child === undefined) {
							warning_list.push(
								`Child ${key} is missing from ${instance.GetFullName()}`,
							);
							no_errors = false;
							continue;
						}
					}
				}
				if (!no_errors) {
					warning_list.push(
						`Children of ${instance.GetFullName()} didnt satisfy the validators`,
					);
					return false;
				}
			}
		}
		return true;
	}
}

export = InstanceValidator;
