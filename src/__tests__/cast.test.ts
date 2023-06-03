import {action, autorun, makeAutoObservable, makeObservable} from "mobx";
import {cast, Castable} from "../cast";
import {Selectable} from "../decorators/Selectable";
import {PostModel} from "./lib/PostModel";
import {UserMetadataModel} from "./lib/UserMetadataModel";
import {assignInstanceProperties} from "../lib/assignInstanceProperties";

describe('cast', () => {
  it('should cast a model', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
    });

    const editableUser = cast(user, EditableUser);

    expect(editableUser.firstName).toBe('Test');
    expect(editableUser.somethingElse).toBe('test');

    editableUser.setFirstName('Test 2');

    expect(editableUser.firstName).toBe('Test 2');
    expect(user.firstName).toBe('Test');
  });

  it('can memoize casted instances', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
    });

    const editableUser = cast(user, EditableUser);
    const editableUser2 = cast(user, EditableUser);

    expect(editableUser).toBe(editableUser2);
  });

  it('can update casted instances', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
    });

    const editableUser = cast(user, EditableUser);
    editableUser.setFirstName('Test 2');

    expect(editableUser.firstName).toBe('Test 2');
    expect(user.firstName).toBe('Test');

    user.assign({ firstName: 'Test 3' });

    expect(user.firstName).toBe('Test 3');
    expect(editableUser.firstName).toBe('Test 3');
  });

  it('can cast a model with multiple classes', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
      lastName: 'Bing bong'
    });

    const editableUserB = cast(user, EditableUser, UseCaseB);

    expect(editableUserB.firstName).toBe('Test');
    expect(editableUserB.lastName).toBe('Bing bong');
    expect(editableUserB.something).toBe('test123');
    expect(editableUserB.somethingElse).toBe('test');

    editableUserB.setFirstName('Test 2');
    expect(editableUserB.firstName).toBe('Test 2');
    expect(user.firstName).toBe('Test');

    editableUserB.setSomething('Set something');
    expect(editableUserB.something).toBe('Set something');

    user.assign({ firstName: 'Test 3', lastName: 'Test 4' });

    expect(editableUserB.firstName).toBe('Test 3');
    expect(editableUserB.lastName).toBe('Test 4');

    const editableUserC = cast(user, EditableUser, UseCaseB);
    const editableUserD = cast(user, UseCaseB, EditableUser);
    const editableUserE = cast(user, EditableUser);

    expect(editableUserB).toBe(editableUserC);
    expect(editableUserB).toBe(editableUserD);
    expect(editableUserB).not.toBe(editableUserE);
  });

  it('preserves observability', () => {
    const user = new UserModel({
      id: 1,
      firstName: 'Test',
      lastName: 'Bing bong'
    });

    const editableUserB = cast(user, EditableUser, UseCaseB);

    const spyA = jest.fn();
    const spyB = jest.fn();

    autorun(() => {
      spyA(editableUserB.firstName);
    });

    autorun(() => {
      spyB(editableUserB.something);
    });

    editableUserB.setFirstName('Test 2');
    editableUserB.setSomething('Set something');

    expect(spyA).toHaveBeenCalledTimes(2);
    expect(spyB).toHaveBeenCalledTimes(2);
  })
});

export class UserModel {
  source: 'local' | 'remote' = 'local';
  __setSource(source: 'local' | 'remote') {
    this.source = source;
  }

  @Selectable() declare id: string
  @Selectable() declare firstName: string
  @Selectable() declare lastName: string;
  @Selectable() declare posts: PostModel[]
  @Selectable() declare metadata: UserMetadataModel;

  constructor(init: any) {
    this.assign(init)

    makeAutoObservable(this);
  }

  assign(data: Partial<UserModel>) {
    assignInstanceProperties(this, data);
  }

  get selectedData() {
    const data = {};
    const keys = ['id', 'firstName', 'lastName', 'posts', 'metadata'];

    keys.forEach(key => {
      try {
        // @ts-ignore
        data[key as any] = this[key as any] as any; // TODO: Types
      } catch (err) {
        // TODO: Check for SelectionError
      }
    });

    return data;
  }
}

class UseCaseB implements Castable<UserModel> {
  firstName: string;
  lastName: string;
  something: string;

  constructor(user: UserModel) {
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.something = 'test123';

    makeAutoObservable(this);
  }

  receiveModel(user: UserModel): void {
    this.firstName = user.firstName;
    this.lastName = user.lastName;
  }

  setSomething(something: string) {
    this.something = something;
  }
}

class EditableUser implements Castable<UserModel> {
  firstName: string;
  somethingElse: string;

  constructor(user: UserModel) {
    this.firstName = user.firstName;
    this.somethingElse = 'test';

    makeAutoObservable(this);
  }

  receiveModel(user: UserModel): void {
    this.firstName = user.firstName;
  }

  setFirstName(firstName: string) {
    this.firstName = firstName;
  }
}