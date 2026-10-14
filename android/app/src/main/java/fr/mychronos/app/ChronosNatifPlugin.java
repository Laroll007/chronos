package fr.mychronos.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Fonctions natives propres à l'app Android.
 *
 * Récupération des données de l'ancienne app (TWA) : elles sont restées dans le
 * navigateur du téléphone, que l'app ne peut pas lire. L'app ouvre donc
 * mychronos.fr/transfert dans ce navigateur ; la page y lit les données et les
 * renvoie par le lien fr.mychronos.app://transfert?d=… que l'app reçoit ici.
 *
 * Enregistrement d'un fichier (sauvegarde) : la WebView ne sait pas télécharger,
 * on passe par le sélecteur « Enregistrer sous » d'Android.
 */
@CapacitorPlugin(name = "ChronosNatif")
public class ChronosNatifPlugin extends Plugin {

    private static final String SITE = "https://mychronos.fr/";

    /** Origine du site affiché par l'app (mychronos.fr, ou le Mac en test local). */
    private String origineSite() {
        String serveur = getBridge().getServerUrl();
        if (serveur == null) return SITE;
        Uri uri = Uri.parse(serveur);
        return uri.getScheme() + "://" + uri.getEncodedAuthority() + "/";
    }

    @Override
    public void load() {
        Activity activite = getActivity();
        Intent intent = activite.getIntent();
        // Relance depuis les applications récentes : Android redonne le lien
        // d'origine, déjà traité.
        if (intent != null && (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) == 0 && traiterLien(intent)) {
            activite.setIntent(new Intent(activite, activite.getClass()));
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        traiterLien(intent);
    }

    private boolean traiterLien(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        Uri uri = intent.getData();
        if (uri == null || !"fr.mychronos.app".equals(uri.getScheme()) || !"transfert".equals(uri.getHost())) return false;
        JSObject ret = new JSObject();
        String donnees = uri.getQueryParameter("d");
        ret.put("donnees", donnees == null ? "" : donnees);
        // Conservé jusqu'à ce que la page écoute (l'app peut démarrer sur ce lien).
        notifyListeners("transfert", ret, true);
        return true;
    }

    /** Navigateurs installés, le navigateur par défaut en premier. */
    @PluginMethod
    public void navigateurs(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent voir = new Intent(Intent.ACTION_VIEW, Uri.parse(SITE));
        voir.addCategory(Intent.CATEGORY_BROWSABLE);

        String parDefaut = null;
        ResolveInfo defaut = pm.resolveActivity(voir, PackageManager.MATCH_DEFAULT_ONLY);
        if (defaut != null && defaut.activityInfo != null) parDefaut = defaut.activityInfo.packageName;

        JSArray liste = new JSArray();
        Set<String> vus = new HashSet<>();
        List<ResolveInfo> trouves = pm.queryIntentActivities(voir, PackageManager.MATCH_ALL);
        for (ResolveInfo info : trouves) {
            if (info.activityInfo == null) continue;
            String paquet = info.activityInfo.packageName;
            if (paquet.equals(getContext().getPackageName()) || !vus.add(paquet)) continue;
            JSObject nav = new JSObject();
            nav.put("paquet", paquet);
            nav.put("nom", String.valueOf(info.loadLabel(pm)));
            nav.put("defaut", paquet.equals(parDefaut));
            liste.put(nav);
        }
        JSObject ret = new JSObject();
        ret.put("navigateurs", liste);
        call.resolve(ret);
    }

    /** Ouvre une page de mychronos.fr dans un navigateur (celui par défaut si aucun n'est précisé). */
    @PluginMethod
    public void ouvrirNavigateur(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.startsWith(origineSite())) {
            call.reject("Adresse refusée");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        String paquet = call.getString("paquet");
        if (paquet != null && !paquet.isEmpty()) intent.setPackage(paquet);
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Navigateur introuvable");
        }
    }

    /** « Enregistrer sous » d'Android pour un fichier texte (sauvegarde JSON). */
    @PluginMethod
    public void enregistrerFichier(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("nom", "chronos-backup.json"));
        startActivityForResult(call, intent, "fichierChoisi");
    }

    @ActivityCallback
    private void fichierChoisi(PluginCall call, ActivityResult resultat) {
        if (call == null) return;
        JSObject ret = new JSObject();
        Intent data = resultat.getData();
        if (resultat.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            ret.put("enregistre", false);
            call.resolve(ret);
            return;
        }
        try (OutputStream sortie = getContext().getContentResolver().openOutputStream(data.getData(), "wt")) {
            if (sortie == null) throw new IllegalStateException("flux indisponible");
            sortie.write(call.getString("contenu", "").getBytes(StandardCharsets.UTF_8));
            ret.put("enregistre", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Enregistrement impossible");
        }
    }
}
