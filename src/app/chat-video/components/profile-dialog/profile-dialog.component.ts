import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../shared/auth.service';

@Component({
  selector: 'app-profile-dialog',
  imports: [
    MatFormFieldModule,
    CommonModule,
    FormsModule,
    MatInputModule,
  ],
  templateUrl: './profile-dialog.component.html',
  styleUrls: ['./profile-dialog.component.css'],
})
export class ProfileDialogComponent {
  photoPreview: string | ArrayBuffer | null = null;
  selectedPhoto: File | null = null;
  isSaving: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<ProfileDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private authService: AuthService
  ) {
    if (this.data?.photoUrl) {
      this.photoPreview = `${this.data.photoUrl}`;
    } else {
      console.log('Aucun photoUrl dans MAT_DIALOG_DATA');
    }
  }

  onPhotoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.selectedPhoto = file;

      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview = reader.result;
      };
      reader.readAsDataURL(file);
    } else {
      console.error('Aucun fichier sélectionné');
    }
  }

  save() {
    if (this.isSaving) {
      console.log('Enregistrement déjà en cours, ignoré');
      return;
    }

    if (!this.data.firstName || !this.data.lastName) {
      console.error('Erreur : firstName ou lastName est vide ou undefined', {
        firstName: this.data.firstName,
        lastName: this.data.lastName,
      });
      return;
    }

    this.isSaving = true;
    console.log('Début de l\'enregistrement...');

    const formData = new FormData();
    formData.append('firstName', this.data.firstName);
    formData.append('lastName', this.data.lastName);
    if (this.selectedPhoto) {
      formData.append('photo', this.selectedPhoto);
    }

    for (const pair of formData.entries()) {
      console.log(`FormData entry: ${pair[0]} = ${pair[1]}`);
    }

    this.authService.updateProfile(formData).subscribe({
      next: (res) => {
        console.log('Profil mis à jour avec succès:', res);
        if (res.photoUrl) {
          this.photoPreview = `http://localhost:3000${res.photoUrl}`;
          console.log('photoPreview mis à jour après enregistrement:', this.photoPreview);
        }
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Erreur lors de la mise à jour:', err);
        this.isSaving = false;
      },
      complete: () => {
        this.isSaving = false;
      },
    });
  }
}
