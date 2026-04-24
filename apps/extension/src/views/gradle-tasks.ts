import * as vscode from "vscode";
import type { GradleService, GradleTask } from "../services/gradle";
import { CONTEXT_KEYS } from "../commands/ids";
import { setAndroidDevkitContext } from "../config/context";

type GradleTreeItem = GroupItem | TaskItem | LoadingItem | ErrorItem | NoWorkspaceItem;

export class GradleTasksProvider implements vscode.TreeDataProvider<GradleTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GradleTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: GradleTask[] = [];
  private error: string | undefined;
  private selectedTaskIds = new Set<string>();

  constructor(private gradleService: GradleService) {}

  refresh(): void {
    this.tasks = [];
    this.error = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GradleTreeItem): vscode.TreeItem {
    if (element instanceof TaskItem) {
      element.checkboxState = this.selectedTaskIds.has(element.id!)
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;
    }
    return element;
  }

  async getChildren(element?: GradleTreeItem): Promise<GradleTreeItem[]> {
    if (!this.gradleService.getProjectFolder()) {
      return [new NoWorkspaceItem()];
    }

    if (element instanceof GroupItem) {
      return this.tasks
        .filter((t) => t.group === element.group)
        .map((t) => new TaskItem(t));
    }

    if (element) return [];

    if (this.tasks.length === 0 && !this.error) {
      try {
        this.tasks = await this.gradleService.listTasks();
        this.error = undefined;
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Unknown error";
        return [new ErrorItem(this.error)];
      }
    }

    if (this.error) return [new ErrorItem(this.error)];

    const groups = [...new Set(this.tasks.map((t) => t.group))].sort();
    return groups.map((g) => {
      const count = this.tasks.filter((t) => t.group === g).length;
      return new GroupItem(g, count);
    });
  }

  handleCheckboxChange(event: vscode.TreeCheckboxChangeEvent<GradleTreeItem>): void {
    for (const [item, state] of event.items) {
      if (!(item instanceof TaskItem) || !item.id) continue;
      if (state === vscode.TreeItemCheckboxState.Checked) {
        this.selectedTaskIds.add(item.id);
      } else {
        this.selectedTaskIds.delete(item.id);
      }
    }
    void setAndroidDevkitContext(CONTEXT_KEYS.gradleTasksHasSelection, this.selectedTaskIds.size > 0);
    this._onDidChangeTreeData.fire();
  }

  getSelectedTasks(): GradleTask[] {
    return this.tasks.filter((t) => {
      const id = `gradle-task:${t.group}:${t.project}:${t.name}`;
      return this.selectedTaskIds.has(id);
    });
  }

  clearSelection(): void {
    this.selectedTaskIds.clear();
    void setAndroidDevkitContext(CONTEXT_KEYS.gradleTasksHasSelection, false);
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

class GroupItem extends vscode.TreeItem {
  constructor(
    public readonly group: string,
    count: number
  ) {
    const label = group.charAt(0).toUpperCase() + group.slice(1);
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = `gradle-group:${group}`;
    this.description = `${count} task${count !== 1 ? "s" : ""}`;
    this.iconPath = new vscode.ThemeIcon("folder");
    this.contextValue = "gradleGroup";
  }
}

export class TaskItem extends vscode.TreeItem {
  constructor(public readonly task: GradleTask) {
    super(task.name, vscode.TreeItemCollapsibleState.None);
    this.id = `gradle-task:${task.group}:${task.project}:${task.name}`;
    this.description = task.project !== ":" ? task.project : undefined;
    this.tooltip = task.description || task.name;
    this.iconPath = new vscode.ThemeIcon("play-circle");
    this.contextValue = "gradleTask";
    this.checkboxState = vscode.TreeItemCheckboxState.Unchecked;
  }
}

class LoadingItem extends vscode.TreeItem {
  constructor() {
    super("Loading Gradle tasks…", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("loading~spin");
  }
}

class ErrorItem extends vscode.TreeItem {
  constructor(message: string) {
    super("Failed to load tasks", vscode.TreeItemCollapsibleState.None);
    this.description = message;
    this.iconPath = new vscode.ThemeIcon("error");
    this.tooltip = message;
  }
}

class NoWorkspaceItem extends vscode.TreeItem {
  constructor() {
    super("No workspace folder open", vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("warning");
  }
}
