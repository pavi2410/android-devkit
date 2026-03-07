import * as vscode from "vscode";
import type { GradleService, GradleTask } from "../services/gradle";
import { ANDROID_DEVKIT_COMMANDS } from "../commands/ids";

type GradleTreeItem = GroupItem | TaskItem | LoadingItem | ErrorItem | NoWorkspaceItem;

export class GradleTasksProvider implements vscode.TreeDataProvider<GradleTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GradleTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: GradleTask[] = [];
  private error: string | undefined;

  constructor(private gradleService: GradleService) {}

  refresh(): void {
    this.tasks = [];
    this.error = undefined;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GradleTreeItem): vscode.TreeItem {
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
    this.command = {
      command: ANDROID_DEVKIT_COMMANDS.runGradleTask,
      title: "Run Task",
      arguments: [this],
    };
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
