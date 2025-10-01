import { Component } from '@angular/core';

@Component({
  selector: 'app-toolbar-set, [toolbarSet]',
  imports: [],
  templateUrl: './toolbar-set.component.html',
  styleUrl: './toolbar-set.component.scss',
  host: {
    class: 'angular-editor-toolbar-set',
  },
})
export class ToolbarSetComponent {}
